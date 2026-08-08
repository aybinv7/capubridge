import { ref, watch } from "vue";
import type { SqliteEditorKind } from "./cellEditorTypes";

/**
 * Per-column editor overrides.
 *
 * Editor detection has to guess for dates and booleans, because SQLite stores
 * both as INTEGER or TEXT. When it guesses wrong the user can pin the editor
 * for that column here, and the choice sticks across sessions.
 */

const STORAGE_KEY = "sqlite-column-editors";

function load(): Record<string, SqliteEditorKind> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, SqliteEditorKind>;
  } catch (error) {
    console.warn("Failed to restore SQLite column editor overrides", error);
  }
  return {};
}

const overrides = ref<Record<string, SqliteEditorKind>>(load());

watch(
  overrides,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      console.warn("Failed to persist SQLite column editor overrides", error);
    }
  },
  { deep: true },
);

function columnKey(dbName: string, tableName: string, columnName: string): string {
  return `${dbName}::${tableName}::${columnName}`;
}

export function useSqliteColumnEditors() {
  function getOverride(
    dbName: string,
    tableName: string,
    columnName: string,
  ): SqliteEditorKind | null {
    return overrides.value[columnKey(dbName, tableName, columnName)] ?? null;
  }

  function setOverride(
    dbName: string,
    tableName: string,
    columnName: string,
    kind: SqliteEditorKind,
  ) {
    overrides.value = {
      ...overrides.value,
      [columnKey(dbName, tableName, columnName)]: kind,
    };
  }

  function clearOverride(dbName: string, tableName: string, columnName: string) {
    const key = columnKey(dbName, tableName, columnName);
    if (!(key in overrides.value)) return;
    const next = { ...overrides.value };
    delete next[key];
    overrides.value = next;
  }

  return { overrides, getOverride, setOverride, clearOverride };
}
