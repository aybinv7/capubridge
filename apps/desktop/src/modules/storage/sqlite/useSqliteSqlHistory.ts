import { ref } from "vue";
import { readPersisted, writePersisted } from "@/lib/persisted";

const HISTORY_KEY = "capubridge:sqlite-sql-history:v1";
const PER_DATABASE = 20;
const DATABASES = 50;

type History = Record<string, string[]>;

function isHistory(value: unknown): value is History {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (list) => Array.isArray(list) && list.every((entry) => typeof entry === "string"),
    )
  );
}

/** Adds `sql` to the top of a database's list: no duplicates, newest first, capped. */
export function rememberQuery(history: History, database: string, sql: string): History {
  const text = sql.trim();
  if (!text || !database) return history;
  const list = [text, ...(history[database] ?? []).filter((entry) => entry !== text)].slice(
    0,
    PER_DATABASE,
  );
  const next: History = { ...history };
  delete next[database];
  next[database] = list;
  const keys = Object.keys(next);
  for (const key of keys.slice(0, Math.max(0, keys.length - DATABASES))) delete next[key];
  return next;
}

const stored = ref<History>(readPersisted<History>(HISTORY_KEY, {}, isHistory));

/** The queries run on each database, newest first, kept across runs (one list per database). */
export function useSqliteSqlHistory() {
  function list(database: string): readonly string[] {
    return stored.value[database] ?? [];
  }

  function remember(database: string, sql: string) {
    const next = rememberQuery(stored.value, database, sql);
    if (next === stored.value) return;
    stored.value = next;
    writePersisted(HISTORY_KEY, next);
  }

  return { list, remember };
}
