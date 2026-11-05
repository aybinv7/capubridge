/** @vitest-environment happy-dom */
import { describe, expect, test, vi } from "vite-plus/test";
import { effectScope, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { IndexedDBStoreSnapshot } from "@/types/storageChanges.types";

const device = vi.hoisted(() => ({
  listeners: new Map<string, (payload: unknown) => void>(),
  captures: 0,
}));

vi.mock("@/stores/targets.store", () => ({ useTargetsStore: () => ({ cdpTargetId: "t1" }) }));
vi.mock("@/stores/targetPresence.store", () => ({
  useTargetPresenceStore: () => ({ presence: "foreground" }),
}));
vi.mock("@/composables/useCDP", () => ({
  useCDP: () => ({
    getClient: () => ({
      on: (event: string, listener: (payload: unknown) => void) => {
        device.listeners.set(event, listener);
        return () => device.listeners.delete(event);
      },
      send: async () => ({}),
    }),
  }),
}));
vi.mock("../indexeddbChanges.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../indexeddbChanges.service")>();
  const snapshot = (): IndexedDBStoreSnapshot => ({
    storeKey: "https://app::db::items",
    origin: "https://app",
    databaseName: "db",
    objectStoreName: "items",
    tracked: true,
    truncated: false,
    recordCount: 0,
    lastSyncedAt: new Date().toISOString(),
    records: {},
  });
  return {
    ...actual,
    fetchOriginCatalog: vi.fn(async () => [
      {
        storeKey: "https://app::db::items",
        origin: "https://app",
        databaseName: "db",
        objectStoreName: "items",
        recordCount: 0,
      },
    ]),
    captureStoreSnapshot: vi.fn(async () => {
      device.captures += 1;
      return snapshot();
    }),
  };
});

const { useIndexedDBChangesLease } = await import("../useIndexedDBChangesTracking");
const { useIndexedDBChangesStore } = await import("../../stores/useIndexedDBChangesStore");
const { useStorageContextStore } = await import("../../stores/useStorageContextStore");

async function settle(ms = 0) {
  for (let i = 0; i < 6; i += 1) {
    await nextTick();
    await Promise.resolve();
  }
  if (ms) await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("the change watcher across tab switches (P3)", () => {
  test("keeps its history when the last screen leaves and still marks device events", async () => {
    setActivePinia(createPinia());
    useStorageContextStore().setSelectedOrigin("t1", "https://app");
    const changes = useIndexedDBChangesStore();

    const first = effectScope();
    first.run(() => useIndexedDBChangesLease());
    await settle(10);
    expect(device.captures).toBe(1);
    changes.markEventObserved("2026-11-05T10:00:00.000Z");
    const session = changes.session;

    first.stop();
    await settle();
    expect(changes.session).toEqual(session);
    expect(changes.lastEventAt).toBe("2026-11-05T10:00:00.000Z");

    device.listeners.get("Storage.indexedDBContentUpdated")?.({
      origin: "https://app",
      databaseName: "db",
      objectStoreName: "items",
    });
    await settle(300);
    expect(changes.lastEventAt).not.toBe("2026-11-05T10:00:00.000Z");
    expect(device.captures).toBe(1);

    const second = effectScope();
    second.run(() => useIndexedDBChangesLease());
    await settle(300);
    expect(device.captures).toBe(2);
    second.stop();
  });
});
