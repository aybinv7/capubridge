import { computed, type Ref } from "vue";
import { storeToRefs } from "pinia";
import type { IDBRecord } from "@capubridge/cdp-protocol";
import type {
  IndexedDBChangeOperation,
  IndexedDBChangeEntry,
  IndexedDBChangeSummary,
  IndexedDBRecordChangeEntry,
} from "@/types/storageChanges.types";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import { buildStoreKey, serializeKey } from "./indexeddbChanges.service";

export interface IndexedDBDecoratedRecord extends IDBRecord {
  __changeId?: string;
  __changeOperation?: IndexedDBChangeOperation;
  __changeObservedAt?: string;
  __changeDeleted?: boolean;
  __recordChange?: IndexedDBRecordChangeEntry;
}

const emptySummary: IndexedDBChangeSummary = {
  add: 0,
  update: 0,
  delete: 0,
  total: 0,
  latestAt: null,
};

function makeSummary(): IndexedDBChangeSummary {
  return { ...emptySummary };
}

function addOperation(summary: IndexedDBChangeSummary, change: IndexedDBRecordChangeEntry) {
  summary[change.operation] += 1;
  summary.total += 1;

  if (!summary.latestAt || change.observedAt > summary.latestAt) {
    summary.latestAt = change.observedAt;
  }
}

function makeDatabaseKey(origin: string, databaseName: string) {
  return `${origin}::${databaseName}`;
}

function makeRecordChangeKey(change: IndexedDBRecordChangeEntry) {
  return `${buildStoreKey(change.origin, change.databaseName, change.objectStoreName)}::${serializeKey(change.key)}`;
}

function isRecordChange(change: IndexedDBChangeEntry): change is IndexedDBRecordChangeEntry {
  return change.kind === "record";
}

function decorateRecord(
  record: IDBRecord,
  change: IndexedDBRecordChangeEntry,
): IndexedDBDecoratedRecord {
  return {
    ...record,
    __changeId: change.id,
    __changeOperation: change.operation,
    __changeObservedAt: change.observedAt,
    __changeDeleted: change.operation === "delete",
    __recordChange: change,
  };
}

const OFF_PAGE_REASON =
  "Changed on the device after this page was read. This is the copy seen then; refresh to edit it.";
const DELETED_REASON = "Deleted on the device.";

/**
 * Puts records the device changed first. A changed record that is on the page keeps the
 * live record (its primary key and whether it can be saved); one that is not, or that was
 * deleted, is shown from the change log and is read-only, because that copy is normalised
 * (sorted keys, `__type` markers) and saving it would overwrite the real value.
 */
export function overlayRecordChanges(
  records: readonly IDBRecord[],
  changesByKey: ReadonlyMap<string, IndexedDBRecordChangeEntry>,
): IndexedDBDecoratedRecord[] {
  const currentByKey = new Map<string, IDBRecord>();
  for (const record of records) currentByKey.set(serializeKey(record.key), record);

  const promoted: IndexedDBDecoratedRecord[] = [];
  const promotedKeys = new Set<string>();
  for (const [key, change] of changesByKey) {
    const current = currentByKey.get(key);
    let record: IDBRecord | null = null;
    if (change.operation === "delete") {
      if (change.beforeValue !== undefined) {
        record = {
          key: change.key,
          value: change.beforeValue,
          editable: false,
          readOnlyReason: DELETED_REASON,
        };
      }
    } else if (current) {
      record = current;
    } else if (change.afterValue !== undefined) {
      record = {
        key: change.key,
        value: change.afterValue,
        editable: false,
        readOnlyReason: OFF_PAGE_REASON,
      };
    }
    if (!record) continue;
    promoted.push(decorateRecord(record, change));
    promotedKeys.add(key);
  }

  const rest = records
    .filter((record) => !promotedKeys.has(serializeKey(record.key)))
    .map((record) => {
      const change = changesByKey.get(serializeKey(record.key));
      return change ? decorateRecord(record, change) : record;
    });
  return [...promoted, ...rest];
}

export function useIndexedDBChangeIndex() {
  const changesStore = useIndexedDBChangesStore();
  const { changes } = storeToRefs(changesStore);

  const latestRecordChanges = computed(() => {
    const latest = new Map<string, IndexedDBRecordChangeEntry>();

    for (const change of changes.value) {
      if (!isRecordChange(change)) continue;

      const key = makeRecordChangeKey(change);

      if (!latest.has(key)) {
        latest.set(key, change);
      }
    }

    return latest;
  });

  const storeSummaries = computed(() => {
    const summaries: Record<string, IndexedDBChangeSummary> = {};

    for (const change of latestRecordChanges.value.values()) {
      const storeKey = buildStoreKey(change.origin, change.databaseName, change.objectStoreName);
      summaries[storeKey] ??= makeSummary();
      addOperation(summaries[storeKey], change);
    }

    return summaries;
  });

  const databaseSummaries = computed(() => {
    const summaries: Record<string, IndexedDBChangeSummary> = {};

    for (const change of latestRecordChanges.value.values()) {
      const databaseKey = makeDatabaseKey(change.origin, change.databaseName);
      summaries[databaseKey] ??= makeSummary();
      addOperation(summaries[databaseKey], change);
    }

    return summaries;
  });

  function getStoreSummary(origin: string, databaseName: string, objectStoreName: string) {
    return (
      storeSummaries.value[buildStoreKey(origin, databaseName, objectStoreName)] ?? emptySummary
    );
  }

  function getDatabaseSummary(origin: string, databaseName: string) {
    return databaseSummaries.value[makeDatabaseKey(origin, databaseName)] ?? emptySummary;
  }

  return {
    latestRecordChanges,
    storeSummaries,
    databaseSummaries,
    getStoreSummary,
    getDatabaseSummary,
  };
}

export function useIndexedDBTableChangeOverlay(
  records: Ref<IDBRecord[]>,
  origin: Ref<string>,
  databaseName: Ref<string>,
  objectStoreName: Ref<string>,
) {
  const { latestRecordChanges, getStoreSummary } = useIndexedDBChangeIndex();

  const storeKey = computed(() =>
    buildStoreKey(origin.value, databaseName.value, objectStoreName.value),
  );

  const recordChangesByKey = computed(() => {
    const changesByKey = new Map<string, IndexedDBRecordChangeEntry>();

    for (const change of latestRecordChanges.value.values()) {
      const changeStoreKey = buildStoreKey(
        change.origin,
        change.databaseName,
        change.objectStoreName,
      );

      if (changeStoreKey !== storeKey.value) continue;

      changesByKey.set(serializeKey(change.key), change);
    }

    return changesByKey;
  });

  const recordsWithChanges = computed<IndexedDBDecoratedRecord[]>(() =>
    overlayRecordChanges(records.value, recordChangesByKey.value),
  );

  const storeSummary = computed(() =>
    getStoreSummary(origin.value, databaseName.value, objectStoreName.value),
  );

  function getRecordChange(record: IDBRecord) {
    return recordChangesByKey.value.get(serializeKey(record.key)) ?? null;
  }

  return {
    recordsWithChanges,
    recordChangesByKey,
    storeSummary,
    getRecordChange,
  };
}
