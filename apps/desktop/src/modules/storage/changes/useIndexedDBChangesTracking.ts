import { computed, onScopeDispose, watch } from "vue";
import { IDBDomain } from "utils";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import { useStorageContextStore } from "@/modules/storage/stores/useStorageContextStore";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import {
  buildStoreKey,
  captureStoreSnapshot,
  diffStoreSnapshots,
  fetchOriginCatalog,
} from "./indexeddbChanges.service";

interface IndexedDBContentUpdatedEvent {
  origin: string;
  storageKey: string;
  bucketId: string;
  databaseName: string;
  objectStoreName: string;
}

interface IndexedDBListUpdatedEvent {
  origin: string;
  storageKey: string;
  bucketId: string;
}

function parseStoreKey(storeKey: string) {
  const [origin, databaseName, objectStoreName] = storeKey.split("::");
  return {
    origin: origin ?? "",
    databaseName: databaseName ?? "",
    objectStoreName: objectStoreName ?? "",
  };
}

export function useIndexedDBChangesTracking() {
  const targetsStore = useTargetsStore();
  const storageContextStore = useStorageContextStore();
  const changesStore = useIndexedDBChangesStore();
  const { getClient } = useCDP();

  const targetId = computed(() => targetsStore.selectedTarget?.id ?? "");
  const origin = computed(() => storageContextStore.getSelectedOrigin(targetId.value));

  let sessionVersion = 0;
  let flushTimer: number | null = null;
  let refreshTimer: number | null = null;
  let unsubscribers: Array<() => void> = [];
  let trackedTargetId = "";
  let trackedOrigin = "";

  function clearTimers() {
    if (flushTimer !== null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }

    if (refreshTimer !== null) {
      window.clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }

  function cleanupActiveTracking() {
    clearTimers();

    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }

    unsubscribers = [];
    changesStore.clearPendingStoreKeys();

    const previousTargetId = trackedTargetId;
    const previousOrigin = trackedOrigin;

    trackedTargetId = "";
    trackedOrigin = "";

    if (previousTargetId && previousOrigin) {
      const previousClient = getClient(previousTargetId);

      if (previousClient) {
        void previousClient
          .send("Storage.untrackIndexedDBForOrigin", {
            origin: previousOrigin,
          })
          .catch(() => {});
      }
    }
  }

  async function primeCatalog(idbDomain: IDBDomain, activeOrigin: string, version: number) {
    const previousCatalogEntries = changesStore.catalogEntries;
    const previousSnapshots = changesStore.snapshots;
    const catalog = await fetchOriginCatalog(idbDomain, activeOrigin);

    if (version !== sessionVersion) return;

    const nextStoreKeys = new Set(catalog.map((entry) => entry.storeKey));
    const removedStoreKeys = previousCatalogEntries
      .map((entry) => entry.storeKey)
      .filter((storeKey) => !nextStoreKeys.has(storeKey));

    changesStore.setCatalog(catalog);

    if (removedStoreKeys.length > 0) {
      changesStore.removeSnapshots(removedStoreKeys);

      for (const storeKey of removedStoreKeys) {
        const removed = parseStoreKey(storeKey);
        changesStore.addSystemChange({
          observedAt: new Date().toISOString(),
          origin: removed.origin,
          databaseName: removed.databaseName,
          objectStoreName: removed.objectStoreName,
          message: `Stopped tracking ${removed.databaseName}.${removed.objectStoreName} because it is no longer available`,
        });
      }
    }

    for (const descriptor of catalog) {
      if (previousSnapshots[descriptor.storeKey] ?? changesStore.getSnapshot(descriptor.storeKey)) {
        continue;
      }

      const snapshot = await captureStoreSnapshot(idbDomain, descriptor);

      if (version !== sessionVersion) return;

      changesStore.upsertSnapshot(snapshot);

      if (!snapshot.tracked) {
        changesStore.addSystemChange({
          observedAt: snapshot.lastSyncedAt,
          origin: snapshot.origin,
          databaseName: snapshot.databaseName,
          objectStoreName: snapshot.objectStoreName,
          message:
            snapshot.reason ??
            `Tracking is disabled for ${snapshot.databaseName}.${snapshot.objectStoreName}`,
        });
      }
    }
  }

  async function flushDirtyStores(idbDomain: IDBDomain, activeOrigin: string, version: number) {
    const dirtyStoreKeys = changesStore.drainPendingStoreKeys();

    if (dirtyStoreKeys.length === 0) return;

    const observedAt = new Date().toISOString();

    for (const storeKey of dirtyStoreKeys) {
      if (version !== sessionVersion) return;

      let descriptor = changesStore.getCatalogEntry(storeKey);

      if (!descriptor) {
        await primeCatalog(idbDomain, activeOrigin, version);

        if (version !== sessionVersion) return;

        descriptor = changesStore.getCatalogEntry(storeKey);

        if (!descriptor) {
          const missing = parseStoreKey(storeKey);
          changesStore.addSystemChange({
            observedAt,
            origin: missing.origin || activeOrigin,
            databaseName: missing.databaseName,
            objectStoreName: missing.objectStoreName,
            message: `Change detected for ${missing.databaseName}.${missing.objectStoreName}, but the store catalog could not be resolved`,
          });
          continue;
        }
      }

      const previousSnapshot = changesStore.getSnapshot(storeKey);
      const nextSnapshot = await captureStoreSnapshot(idbDomain, descriptor);

      if (version !== sessionVersion) return;

      changesStore.upsertSnapshot(nextSnapshot);

      if (!previousSnapshot) {
        continue;
      }

      if (!previousSnapshot.tracked || !nextSnapshot.tracked) {
        if (
          !nextSnapshot.tracked &&
          (previousSnapshot.tracked || previousSnapshot.reason !== nextSnapshot.reason)
        ) {
          changesStore.addSystemChange({
            observedAt,
            origin: nextSnapshot.origin,
            databaseName: nextSnapshot.databaseName,
            objectStoreName: nextSnapshot.objectStoreName,
            message:
              nextSnapshot.reason ??
              `Tracking is disabled for ${nextSnapshot.databaseName}.${nextSnapshot.objectStoreName}`,
          });
        }
        continue;
      }

      const diffEntries = diffStoreSnapshots(previousSnapshot, nextSnapshot, observedAt);

      if (diffEntries.length > 0) {
        changesStore.addChanges(diffEntries);
      }
    }

    changesStore.markEventObserved(observedAt);
  }

  function scheduleFlush(idbDomain: IDBDomain, activeOrigin: string, version: number) {
    if (flushTimer !== null) return;

    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      void flushDirtyStores(idbDomain, activeOrigin, version);
    }, 220);
  }

  function scheduleCatalogRefresh(idbDomain: IDBDomain, activeOrigin: string, version: number) {
    if (refreshTimer !== null) {
      window.clearTimeout(refreshTimer);
    }

    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      void primeCatalog(idbDomain, activeOrigin, version);
    }, 180);
  }

  watch(
    [targetId, origin],
    async ([nextTargetId, nextOrigin], _previous, onCleanup) => {
      sessionVersion += 1;
      const version = sessionVersion;

      cleanupActiveTracking();
      changesStore.finishSession();

      if (!nextTargetId || !nextOrigin) {
        return;
      }

      const client = getClient(nextTargetId);

      if (!client) {
        changesStore.startSession(nextTargetId, nextOrigin);
        changesStore.setErrorMessage("No active CDP connection");
        return;
      }

      const idbDomain = new IDBDomain(client);

      trackedTargetId = nextTargetId;
      trackedOrigin = nextOrigin;

      changesStore.startSession(nextTargetId, nextOrigin);

      const handleContentUpdated = (payload: unknown) => {
        const event = payload as IndexedDBContentUpdatedEvent;

        if (event.origin !== nextOrigin) return;

        changesStore.queueStore(
          buildStoreKey(event.origin, event.databaseName, event.objectStoreName),
        );
        scheduleFlush(idbDomain, nextOrigin, version);
      };

      const handleListUpdated = (payload: unknown) => {
        const event = payload as IndexedDBListUpdatedEvent;

        if (event.origin !== nextOrigin) return;

        scheduleCatalogRefresh(idbDomain, nextOrigin, version);
      };

      unsubscribers = [
        client.on("Storage.indexedDBContentUpdated", handleContentUpdated),
        client.on("Storage.indexedDBListUpdated", handleListUpdated),
      ];

      onCleanup(() => {
        cleanupActiveTracking();
      });

      try {
        await client.send("Storage.trackIndexedDBForOrigin", {
          origin: nextOrigin,
        });

        if (version !== sessionVersion) return;

        await primeCatalog(idbDomain, nextOrigin, version);

        if (version !== sessionVersion) return;

        changesStore.setStatus("tracking");
        changesStore.setErrorMessage(null);
      } catch (error) {
        if (version !== sessionVersion) return;
        changesStore.setErrorMessage(String(error));
      }
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    cleanupActiveTracking();
    changesStore.finishSession();
  });

  return {
    targetId,
    origin,
  };
}
