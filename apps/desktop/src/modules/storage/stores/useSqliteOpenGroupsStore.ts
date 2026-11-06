import { shallowRef } from "vue";
import { defineStore } from "pinia";
import { readPersisted, writePersisted } from "@/lib/persisted";

const STORAGE_KEY = "capubridge:sqlite-open-groups";
/** Tables kept; the least recently changed go first. */
const TABLES_CAP = 60;
/** Open groups kept per table and column. */
const GROUPS_CAP = 300;
/** A value key longer than this stays open for the session but is not written to disk. */
const KEY_PERSIST_LIMIT = 512;

/** Per table (`<state key>/<table>`), per grouped column, the value keys of the open groups. */
type OpenGroups = Record<string, Record<string, string[]>>;

function isOpenGroups(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (columns) =>
      typeof columns === "object" &&
      columns !== null &&
      Object.values(columns).every(
        (keys) => Array.isArray(keys) && keys.every((key) => typeof key === "string"),
      ),
  );
}

const EMPTY: ReadonlySet<string> = new Set();

/**
 * Which groups are open in each table's grouped view, by value, so a table comes back with the
 * same groups open. Kept on disk with caps, so it never grows without bound.
 */
export const useSqliteOpenGroupsStore = defineStore("sqlite-open-groups", () => {
  const groups = shallowRef<OpenGroups>(readPersisted<OpenGroups>(STORAGE_KEY, {}, isOpenGroups));

  function openKeys(table: string, column: string): ReadonlySet<string> {
    const keys = groups.value[table]?.[column];
    return keys && keys.length > 0 ? new Set(keys) : EMPTY;
  }

  function persist(next: OpenGroups) {
    const tables = Object.keys(next);
    const kept =
      tables.length > TABLES_CAP
        ? Object.fromEntries(tables.slice(-TABLES_CAP).map((table) => [table, next[table] ?? {}]))
        : next;
    groups.value = kept;
    const onDisk = Object.fromEntries(
      Object.entries(kept).map(([table, columns]) => [
        table,
        Object.fromEntries(
          Object.entries(columns).map(([column, keys]) => [
            column,
            keys.filter((key) => key.length <= KEY_PERSIST_LIMIT),
          ]),
        ),
      ]),
    );
    writePersisted(STORAGE_KEY, onDisk);
  }

  /** Opens (`true`) or closes the groups with these value keys. */
  function setOpen(table: string, column: string, keys: readonly string[], open: boolean) {
    const current = groups.value[table]?.[column] ?? [];
    const drop = new Set(keys);
    const rest = current.filter((key) => !drop.has(key));
    const next = (open ? [...rest, ...keys] : rest).slice(-GROUPS_CAP);
    const { [table]: columns, ...others } = groups.value;
    persist({ ...others, [table]: { ...columns, [column]: next } });
  }

  /** Closes every group of one column of a table. */
  function closeAll(table: string, column: string) {
    if (!groups.value[table]?.[column]?.length) return;
    const { [table]: columns, ...others } = groups.value;
    persist({ ...others, [table]: { ...columns, [column]: [] } });
  }

  return { openKeys, setOpen, closeAll };
});
