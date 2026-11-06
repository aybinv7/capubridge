import { shallowRef, watch, type ShallowRef } from "vue";
import { readPersisted, writePersisted } from "@/lib/persisted";

interface LogsPrefsState {
  hideEchoes: boolean;
  processColumn: boolean;
}

const KEY = "capubridge:drawer-logs";
const DEFAULTS: LogsPrefsState = { hideEchoes: false, processColumn: false };

function isPrefs(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.hideEchoes === "boolean" && typeof candidate.processColumn === "boolean";
}

export interface LogsPrefs {
  /** Hide the lines a WebView repeats from `console.*`; the Console view has them. */
  hideEchoes: ShallowRef<boolean>;
  /** Show the process id and package as a column, not only on hover. */
  processColumn: ShallowRef<boolean>;
  /** The query, kept while the view is switched away from. */
  query: ShallowRef<string>;
}

let prefs: LogsPrefs | null = null;

/** The Logs view's own choices for this window; the toggles persist, the query does not. */
export function useLogsPrefs(): LogsPrefs {
  if (prefs) return prefs;
  const saved = readPersisted<LogsPrefsState>(KEY, DEFAULTS, isPrefs);
  const created: LogsPrefs = {
    hideEchoes: shallowRef(saved.hideEchoes),
    processColumn: shallowRef(saved.processColumn),
    query: shallowRef(""),
  };
  watch([created.hideEchoes, created.processColumn], ([hideEchoes, processColumn]) => {
    writePersisted(KEY, { hideEchoes, processColumn } satisfies LogsPrefsState);
  });
  prefs = created;
  return created;
}
