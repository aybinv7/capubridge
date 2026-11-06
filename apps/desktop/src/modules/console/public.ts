import { useConsolePrefs } from "./stream/consolePrefs";
import { useLogsPrefs } from "./logcat/logsPrefs";

export { default as LogsView } from "./logcat/LogsView.vue";
export { default as ConsoleView } from "./stream/ConsoleView.vue";

/** Clears the query of `view`; false when it was already empty, so Escape can leave instead. */
export function clearDrawerQuery(view: "logs" | "console"): boolean {
  const query = view === "logs" ? useLogsPrefs().query : useConsolePrefs().query;
  if (!query.value.trim()) return false;
  query.value = "";
  return true;
}
