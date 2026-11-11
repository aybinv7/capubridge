import { computed } from "vue";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { withTimeout } from "@/shared/async/withTimeout";

/** How long a Data read waits for the phone before it says so in plain words. */
export const DATA_READ_TIMEOUT_MS = 10_000;

/**
 * Whether the app a Data tab reads is on screen. While it is in the background (or another
 * WebView is on screen) Android may freeze it, so reads wait instead of timing out and writes are
 * held. The tab says why; the title bar's "Bring to front" is the one way back. Reads run again
 * when the app returns.
 */
export function useDataPresence() {
  const presence = useTargetPresenceStore();

  const away = computed<string | null>(() => {
    if (presence.presence === "background") {
      return "The app is in the background, so the phone cannot answer. Bring it to the front from the top bar.";
    }
    if (presence.presence === "view-hidden") {
      return "Another screen of the app is showing, so this page cannot answer. Open this page on the phone again.";
    }
    return null;
  });

  return { away };
}

/** Rejects with a plain sentence when the phone does not answer within `ms`. */
export function withReadTimeout<T>(task: Promise<T>, ms = DATA_READ_TIMEOUT_MS): Promise<T> {
  return withTimeout(task, ms, "The phone did not answer");
}
