import { ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import type {
  SqliteChangeEntry,
  SqliteChangeOperation,
  SqliteRecordChange,
  SqliteSystemChange,
} from "@/types/sqliteChanges.types";

const MAX_FEED_ENTRIES = 1000;

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildTableKey(
  serial: string,
  packageName: string,
  dbPath: string,
  tableName: string,
): string {
  return `${serial}::${packageName}::${dbPath}::${tableName}`;
}

export function buildDatabaseKey(serial: string, packageName: string, dbPath: string): string {
  return `${serial}::${packageName}::${dbPath}`;
}

export const useSqliteChangesStore = defineStore("sqlite-changes", () => {
  const changes = shallowRef<SqliteChangeEntry[]>([]);
  const selectedChangeId = ref("");

  function recordChange(
    input: Omit<SqliteRecordChange, "id" | "kind" | "observedAt"> & { observedAt?: string },
  ) {
    const entry: SqliteRecordChange = {
      id: makeId(),
      kind: "record",
      observedAt: input.observedAt ?? new Date().toISOString(),
      operation: input.operation,
      serial: input.serial,
      packageName: input.packageName,
      dbPath: input.dbPath,
      tableName: input.tableName,
      rowKey: input.rowKey,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue,
    };
    changes.value = [entry, ...changes.value].slice(0, MAX_FEED_ENTRIES);
    if (!selectedChangeId.value) selectedChangeId.value = entry.id;
  }

  function recordSystemChange(
    input: Omit<SqliteSystemChange, "id" | "kind" | "observedAt"> & { observedAt?: string },
  ) {
    const entry: SqliteSystemChange = {
      id: makeId(),
      kind: "system",
      observedAt: input.observedAt ?? new Date().toISOString(),
      serial: input.serial,
      packageName: input.packageName,
      dbPath: input.dbPath,
      tableName: input.tableName,
      message: input.message,
    };
    changes.value = [entry, ...changes.value].slice(0, MAX_FEED_ENTRIES);
  }

  function clearWhere(predicate: (entry: SqliteChangeEntry) => boolean) {
    const next = changes.value.filter((e) => !predicate(e));
    changes.value = next;
    if (!next.some((e) => e.id === selectedChangeId.value)) {
      selectedChangeId.value = next[0]?.id ?? "";
    }
  }

  function clearAll() {
    changes.value = [];
    selectedChangeId.value = "";
  }

  function clearTableChanges(
    serial: string,
    packageName: string,
    dbPath: string,
    tableName: string,
  ) {
    clearWhere(
      (e) =>
        e.serial === serial &&
        e.packageName === packageName &&
        e.dbPath === dbPath &&
        ("tableName" in e ? e.tableName === tableName : false),
    );
  }

  function clearDatabaseChanges(serial: string, packageName: string, dbPath: string) {
    clearWhere((e) => e.serial === serial && e.packageName === packageName && e.dbPath === dbPath);
  }

  function selectChange(id: string) {
    selectedChangeId.value = id;
  }

  return {
    changes,
    selectedChangeId,
    recordChange,
    recordSystemChange,
    clearAll,
    clearTableChanges,
    clearDatabaseChanges,
    selectChange,
    buildTableKey,
    buildDatabaseKey,
  };
});

export type { SqliteChangeOperation };
