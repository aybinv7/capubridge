import { watch, type Ref } from "vue";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import type { SqliteDbFile } from "@/types/sqlite.types";

/**
 * WebView databases can only be discovered while DevTools is connected and the app is
 * on screen. Discovery therefore runs again when the link comes up (the first scan
 * often races the connection) and when the app returns from the background.
 */
export function useSqliteRediscovery(
  databases: Ref<readonly SqliteDbFile[]>,
  rediscover: () => Promise<void>,
) {
  const context = useActiveContextStore();
  const presence = useTargetPresenceStore();

  function webviewDatabasesMissing(): boolean {
    return !databases.value.some(
      (db) => (db.sourceKind === "opfs" || db.sourceKind === "jeep-sqlite") && !db.unreachable,
    );
  }

  watch(
    () => context.isTargetConnected,
    (connected, wasConnected) => {
      if (connected && !wasConnected && webviewDatabasesMissing()) void rediscover();
    },
  );

  watch(
    () => presence.presence,
    (next, previous) => {
      const returned = next === "foreground" && (previous === "background" || previous === "gone");
      if (returned && databases.value.some((db) => db.unreachable)) void rediscover();
    },
  );

  /** True while the WebView cannot answer discovery, so missing results are not "no databases". */
  function webviewAway(): boolean {
    return (
      !context.isTargetConnected ||
      presence.presence === "background" ||
      presence.presence === "gone"
    );
  }

  return { webviewAway };
}
