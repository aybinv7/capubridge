import { describe, expect, test, vi } from "vite-plus/test";
import type { IDBDomain, IDBRecord } from "@capubridge/cdp-protocol";
import type {
  IndexedDBRecordChangeEntry,
  IndexedDBStoreSnapshot,
} from "@/types/storageChanges.types";
import { overlayRecordChanges } from "../useIndexedDBChangeOverlay";
import { serializeKey } from "../indexeddbChanges.service";

const captured = vi.hoisted(() => ({ next: [] as IndexedDBStoreSnapshot[] }));

vi.mock("../indexeddbChanges.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../indexeddbChanges.service")>();
  return {
    ...actual,
    fetchOriginCatalog: vi.fn(async () => [
      {
        storeKey: "o::db::items",
        origin: "o",
        databaseName: "db",
        objectStoreName: "items",
        recordCount: 1,
      },
    ]),
    captureStoreSnapshot: vi.fn(async () => {
      const next = captured.next.shift();
      if (!next) throw new Error("no snapshot queued");
      return next;
    }),
  };
});

const { createChangeTracker } = await import("../indexeddbChangeTracker");

function change(
  key: IDBValidKey,
  operation: IndexedDBRecordChangeEntry["operation"],
  afterValue?: unknown,
): IndexedDBRecordChangeEntry {
  return {
    id: JSON.stringify(key),
    kind: "record",
    source: "external",
    observedAt: "2024-01-01T00:00:00.000Z",
    origin: "o",
    databaseName: "db",
    objectStoreName: "items",
    operation,
    key,
    keyLabel: JSON.stringify(key),
    beforeValue: { name: "before" },
    afterValue,
    fieldDiffs: [],
  };
}

describe("overlayRecordChanges", () => {
  test("a changed record on the page keeps its primary key and read-only flag", () => {
    const live: IDBRecord = {
      key: 1,
      primaryKey: 1,
      value: { name: "now" },
      editable: false,
      readOnlyReason: "Holds a Date",
    };
    const [first] = overlayRecordChanges(
      [{ key: 0, value: 0 }, live],
      new Map([[serializeKey(1), change(1, "update", { name: "now" })]]),
    );
    expect(first).toMatchObject({
      key: 1,
      primaryKey: 1,
      editable: false,
      readOnlyReason: "Holds a Date",
      __changeOperation: "update",
    });
  });

  test("a change seen off the page is shown read-only, never saved back", () => {
    const [first] = overlayRecordChanges(
      [],
      new Map([[serializeKey(7), change(7, "add", { name: "new" })]]),
    );
    expect(first?.editable).toBe(false);
    expect(first?.readOnlyReason).toMatch(/refresh to edit it/);
  });

  test("a deleted record is read-only", () => {
    const [first] = overlayRecordChanges(
      [{ key: 3, value: 1, editable: true }],
      new Map([[serializeKey(3), change(3, "delete")]]),
    );
    expect(first).toMatchObject({ editable: false, __changeDeleted: true });
  });
});

function snapshot(records: Record<string, unknown>): IndexedDBStoreSnapshot {
  return {
    storeKey: "o::db::items",
    origin: "o",
    databaseName: "db",
    objectStoreName: "items",
    tracked: true,
    truncated: false,
    recordCount: Object.keys(records).length,
    lastSyncedAt: "2024-01-01T00:00:00.000Z",
    records: Object.fromEntries(
      Object.entries(records).map(([key, value]) => [
        serializeKey(Number(key)),
        { key: Number(key), keyLabel: key, stableValue: JSON.stringify(value), value },
      ]),
    ),
  };
}

function fakeStore() {
  const snapshots: Record<string, IndexedDBStoreSnapshot> = {};
  let pending: string[] = [];
  return {
    catalogEntries: [],
    snapshots,
    added: [] as unknown[],
    observed: [] as string[],
    queue(key: string) {
      pending.push(key);
    },
    setCatalog: vi.fn(),
    removeSnapshots: vi.fn(),
    addSystemChange: vi.fn(),
    getSnapshot: (key: string) => snapshots[key],
    upsertSnapshot(next: IndexedDBStoreSnapshot) {
      snapshots[next.storeKey] = next;
    },
    drainPendingStoreKeys() {
      const out = pending;
      pending = [];
      return out;
    },
    getCatalogEntry: () => ({
      storeKey: "o::db::items",
      origin: "o",
      databaseName: "db",
      objectStoreName: "items",
      recordCount: 1,
    }),
    addChanges(entries: unknown[]) {
      this.added.push(...entries);
    },
    markEventObserved(at: string) {
      this.observed.push(at);
    },
  };
}

describe("createChangeTracker", () => {
  test("Capubridge's own writes are tagged and do not count as the app writing", async () => {
    const store = fakeStore();
    captured.next = [snapshot({ 1: "a" }), snapshot({ 1: "b" })];
    const tracker = createChangeTracker({
      domain: {} as IDBDomain,
      origin: "o",
      store: store as never,
      isOwnWrite: (_storeKey, key) => key === 1,
    });
    await tracker.prime();
    store.queue("o::db::items");
    await tracker.flush();
    expect(store.added).toMatchObject([{ source: "capubridge", operation: "update" }]);
    expect(store.observed).toEqual([]);
  });

  test("a flush that finds nothing does not report a database write", async () => {
    const store = fakeStore();
    captured.next = [snapshot({ 1: "a" }), snapshot({ 1: "a" })];
    const tracker = createChangeTracker({
      domain: {} as IDBDomain,
      origin: "o",
      store: store as never,
      isOwnWrite: () => false,
    });
    await tracker.prime();
    store.queue("o::db::items");
    await tracker.flush();
    expect(store.added).toEqual([]);
    expect(store.observed).toEqual([]);
  });

  test("an app write is reported, and one flush runs at a time", async () => {
    const store = fakeStore();
    captured.next = [snapshot({ 1: "a" }), snapshot({ 1: "b" }), snapshot({ 1: "c" })];
    const tracker = createChangeTracker({
      domain: {} as IDBDomain,
      origin: "o",
      store: store as never,
      isOwnWrite: () => false,
    });
    await tracker.prime();
    store.queue("o::db::items");
    const first = tracker.flush();
    store.queue("o::db::items");
    const second = tracker.flush();
    expect(second).toBe(first);
    await first;
    expect(store.added).toHaveLength(2);
    expect(store.observed).toHaveLength(2);
  });
});
