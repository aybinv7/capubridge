import { shallowRef, type ShallowRef } from "vue";

export interface ConsolePrefs {
  /** The query, kept while the view is switched away from. */
  query: ShallowRef<string>;
}

let prefs: ConsolePrefs | null = null;

/** The Console view's own state for this window. */
export function useConsolePrefs(): ConsolePrefs {
  prefs ??= { query: shallowRef("") };
  return prefs;
}
