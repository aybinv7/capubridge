import { computed, type Ref } from "vue";
import { storeToRefs } from "pinia";
import type {
  SqliteChangeEntry,
  SqliteChangeSummary,
  SqliteRecordChange,
} from "@/types/sqliteChanges.types";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import {
  useSqliteChangesStore,
  buildTableKey,
  buildDatabaseKey,
} from "@/modules/storage/stores/useSqliteChangesStore";

const emptySummary: SqliteChangeSummary = {
  add: 0,
  update: 0,
  delete: 0,
  total: 0,
  latestAt: null,
};

function makeSummary(): SqliteChangeSummary {
  return { ...emptySummary };
}

function addOperation(summary: SqliteChangeSummary, change: SqliteRecordChange) {
  summary[change.operation] += 1;
  summary.total += 1;
  if (!summary.latestAt || change.observedAt > summary.latestAt) {
    summary.latestAt = change.observedAt;
  }
}

function isRecordChange(change: SqliteChangeEntry): change is SqliteRecordChange {
  return change.kind === "record";
}

export function buildRowKey(
  pkColumns: SqliteColumnInfo[],
  record: Record<string, unknown>,
): string {
  if (pkColumns.length === 0) return "";
  const sorted = [...pkColumns].sort((a, b) => a.cid - b.cid);
  return JSON.stringify(sorted.map((c) => record[c.name] ?? null));
}

export function useSqliteChangeIndex() {
  const changesStore = useSqliteChangesStore();
  const { changes } = storeToRefs(changesStore);

  const latestRecordChanges = computed(() => {
    const latest = new Map<string, SqliteRecordChange>();
    for (const change of changes.value) {
      if (!isRecordChange(change)) continue;
      const key = `${buildTableKey(change.serial, change.packageName, change.dbPath, change.tableName)}::${change.rowKey}`;
      if (!latest.has(key)) latest.set(key, change);
    }
    return latest;
  });

  const tableSummaries = computed(() => {
    const out: Record<string, SqliteChangeSummary> = {};
    for (const change of latestRecordChanges.value.values()) {
      const key = buildTableKey(change.serial, change.packageName, change.dbPath, change.tableName);
      out[key] ??= makeSummary();
      addOperation(out[key], change);
    }
    return out;
  });

  const databaseSummaries = computed(() => {
    const out: Record<string, SqliteChangeSummary> = {};
    for (const change of latestRecordChanges.value.values()) {
      const key = buildDatabaseKey(change.serial, change.packageName, change.dbPath);
      out[key] ??= makeSummary();
      addOperation(out[key], change);
    }
    return out;
  });

  function getTableSummary(
    serial: string,
    packageName: string,
    dbPath: string,
    tableName: string,
  ): SqliteChangeSummary {
    return (
      tableSummaries.value[buildTableKey(serial, packageName, dbPath, tableName)] ?? emptySummary
    );
  }

  function getDatabaseSummary(
    serial: string,
    packageName: string,
    dbPath: string,
  ): SqliteChangeSummary {
    return databaseSummaries.value[buildDatabaseKey(serial, packageName, dbPath)] ?? emptySummary;
  }

  return {
    latestRecordChanges,
    tableSummaries,
    databaseSummaries,
    getTableSummary,
    getDatabaseSummary,
  };
}

export function useSqliteTableChangeOverlay(options: {
  serial: Ref<string>;
  packageName: Ref<string>;
  dbPath: Ref<string>;
  tableName: Ref<string>;
  pkColumns: Ref<SqliteColumnInfo[]>;
}) {
  const { latestRecordChanges, getTableSummary } = useSqliteChangeIndex();

  const tableKey = computed(() =>
    buildTableKey(
      options.serial.value,
      options.packageName.value,
      options.dbPath.value,
      options.tableName.value,
    ),
  );

  const changesByRowKey = computed(() => {
    const map = new Map<string, SqliteRecordChange>();
    for (const change of latestRecordChanges.value.values()) {
      const key = buildTableKey(change.serial, change.packageName, change.dbPath, change.tableName);
      if (key !== tableKey.value) continue;
      map.set(change.rowKey, change);
    }
    return map;
  });

  const tableSummary = computed(() =>
    getTableSummary(
      options.serial.value,
      options.packageName.value,
      options.dbPath.value,
      options.tableName.value,
    ),
  );

  function lookup(record: Record<string, unknown>): SqliteRecordChange | null {
    const key = buildRowKey(options.pkColumns.value, record);
    if (!key) return null;
    return changesByRowKey.value.get(key) ?? null;
  }

  return { changesByRowKey, tableSummary, lookup };
}
