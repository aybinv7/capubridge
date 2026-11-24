import {
  LiveSqlite,
  type LiveSqliteChange,
  type LiveSqliteOutcome,
} from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";

/** How a change through the app's own connection behaves, said in every question that makes one. */
export const LIVE_COST =
  "It is written through the app's own SQLite connection while the app runs, without a reload. The app sees it the next time it reads; what a screen already shows stays until then. If that connection cannot be used, you are asked before the app is paused instead.";

/**
 * Changes the selected page's SQLite database through the app's own sqlite-wasm connection (see
 * `LiveSqlite`). A page that is not connected answers `unavailable`, so the caller can pause.
 */
export function useLiveSqlite() {
  const { getClient } = useCDP();
  const targets = useTargetsStore();

  async function apply(filename: string, change: LiveSqliteChange): Promise<LiveSqliteOutcome> {
    const client = getClient(targets.cdpTargetId);
    if (!client) return { status: "unavailable", reason: "The page is not connected." };
    return new LiveSqlite(client).apply(filename, change);
  }

  return { apply };
}
