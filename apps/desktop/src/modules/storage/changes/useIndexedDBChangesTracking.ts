import { computed, effectScope, onScopeDispose, ref, watch, type EffectScope } from "vue";
import { useDocumentVisibility } from "@vueuse/core";
import { IDBDomain } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { useStorageContextStore } from "@/modules/storage/stores/useStorageContextStore";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import { buildStoreKey, serializeKey } from "./indexeddbChanges.service";
import { createChangeTracker, type ChangeTracker } from "./indexeddbChangeTracker";

interface IndexedDBContentUpdatedEvent {
  origin: string;
  databaseName: string;
  objectStoreName: string;
}

interface IndexedDBListUpdatedEvent {
  origin: string;
}

const FLUSH_DELAY_MS = 220;
const MIN_FLUSH_SPACING_MS = 1000;
const CATALOG_DELAY_MS = 180;

let holders = 0;
let scope: EffectScope | null = null;
const leased = ref(false);
let activeTracker: ChangeTracker | null = null;

/** Watches a store the change watcher left out because of its store cap. */
export async function watchIndexedDBStore(storeKey: string): Promise<void> {
  await activeTracker?.watchStore(storeKey);
}

function runTracking() {
  const targetsStore = useTargetsStore();
  const storageContextStore = useStorageContextStore();
  const changesStore = useIndexedDBChangesStore();
  const presenceStore = useTargetPresenceStore();
  const visibility = useDocumentVisibility();
  const { getClient } = useCDP();

  const targetId = computed(() => targetsStore.cdpTargetId);
  const origin = computed(() => storageContextStore.getSelectedOrigin(targetId.value));
  const paused = computed(
    () =>
      !leased.value ||
      visibility.value === "hidden" ||
      presenceStore.presence === "background" ||
      presenceStore.presence === "view-hidden",
  );

  let tracker: ChangeTracker | null = null;
  let unprimed: ChangeTracker | null = null;

  async function primeTracker(current: ChangeTracker) {
    try {
      await current.prime();
      if (current.stopped) return;
      changesStore.setStatus(paused.value ? "paused" : "tracking");
      changesStore.setErrorMessage(null);
    } catch (error) {
      if (!current.stopped) changesStore.setErrorMessage(String(error));
    }
  }

  watch(leased, (isLeased) => {
    const pending = unprimed;
    if (!isLeased || !pending || pending.stopped) return;
    unprimed = null;
    void primeTracker(pending);
  });
  let flushTimer: number | null = null;
  let catalogTimer: number | null = null;

  function clearTimers() {
    if (flushTimer !== null) window.clearTimeout(flushTimer);
    if (catalogTimer !== null) window.clearTimeout(catalogTimer);
    flushTimer = null;
    catalogTimer = null;
  }

  let lastFlushEnd = 0;
  let lastFlushMs = 0;

  async function runFlush() {
    const current = tracker;
    if (!current) return;
    const started = Date.now();
    try {
      await current.flush();
    } catch (error) {
      if (!current.stopped) changesStore.setErrorMessage(String(error));
    } finally {
      lastFlushMs = Date.now() - started;
      lastFlushEnd = Date.now();
    }
  }

  /** Flushes are spaced by at least 1 s, or twice the last flush when that took longer. */
  function scheduleFlush() {
    if (flushTimer !== null || paused.value) return;
    const spacing = Math.max(MIN_FLUSH_SPACING_MS, 2 * lastFlushMs);
    const delay = Math.max(FLUSH_DELAY_MS, spacing - (Date.now() - lastFlushEnd));
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      void runFlush();
    }, delay);
  }

  function scheduleCatalog() {
    if (catalogTimer !== null) window.clearTimeout(catalogTimer);
    catalogTimer = window.setTimeout(() => {
      catalogTimer = null;
      void tracker?.prime();
    }, CATALOG_DELAY_MS);
  }

  watch(paused, (isPaused) => {
    if (!tracker) return;
    changesStore.setStatus(isPaused ? "paused" : "tracking");
    if (!isPaused && changesStore.pendingStoreKeys.size > 0) scheduleFlush();
  });

  watch(
    [targetId, origin],
    async ([nextTargetId, nextOrigin], _previous, onCleanup) => {
      clearTimers();
      tracker?.stop();
      tracker = null;
      activeTracker = null;
      unprimed = null;
      changesStore.finishSession();
      if (!nextTargetId || !nextOrigin) return;

      const client = getClient(nextTargetId);
      changesStore.startSession(nextTargetId, nextOrigin);
      if (!client) {
        changesStore.setErrorMessage("No active CDP connection");
        return;
      }

      const current = createChangeTracker({
        domain: new IDBDomain(client),
        origin: nextOrigin,
        store: changesStore,
        isOwnWrite: (storeKey, key) => changesStore.isOwnWrite(storeKey, serializeKey(key)),
        paused: () => paused.value,
      });
      tracker = current;
      activeTracker = current;

      const unsubscribers = [
        client.on("Storage.indexedDBContentUpdated", (payload: unknown) => {
          const event = payload as IndexedDBContentUpdatedEvent;
          if (event.origin !== nextOrigin) return;
          const storeKey = buildStoreKey(event.origin, event.databaseName, event.objectStoreName);
          changesStore.queueStore(storeKey);
          if (!leased.value && !changesStore.wroteRecently(storeKey)) {
            changesStore.markEventObserved(new Date().toISOString());
          }
          scheduleFlush();
        }),
        client.on("Storage.indexedDBListUpdated", (payload: unknown) => {
          if ((payload as IndexedDBListUpdatedEvent).origin === nextOrigin) scheduleCatalog();
        }),
      ];

      onCleanup(() => {
        clearTimers();
        current.stop();
        for (const unsubscribe of unsubscribers) unsubscribe();
        changesStore.clearPendingStoreKeys();
        void client
          .send("Storage.untrackIndexedDBForOrigin", { origin: nextOrigin })
          .catch((error: unknown) => {
            console.warn("Failed to stop IndexedDB change tracking", nextOrigin, error);
          });
      });

      try {
        await client.send("Storage.trackIndexedDBForOrigin", { origin: nextOrigin });
        if (current.stopped) return;
        if (leased.value) await primeTracker(current);
        else unprimed = current;
      } catch (error) {
        if (!current.stopped) changesStore.setErrorMessage(String(error));
      }
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    clearTimers();
    tracker?.stop();
    tracker = null;
    changesStore.finishSession();
  });
}

/**
 * Watches the selected origin's IndexedDB for device changes while a screen that shows them
 * is mounted (IndexedDB, Graph). One tracker however many screens hold it; it pauses while the
 * window is hidden or the app is in the background. When the last holder leaves, the change
 * feed and the baselines stay (they reset only when the target or origin changes) and the
 * tracker only listens: device events still mark `lastEventAt` for automation and queue their
 * stores, which are compared once a screen holds the lease again.
 */
export function useIndexedDBChangesLease() {
  holders += 1;
  leased.value = true;
  if (!scope) {
    scope = effectScope(true);
    scope.run(runTracking);
  }
  onScopeDispose(() => {
    holders -= 1;
    if (holders === 0) leased.value = false;
  });
}
