import { computed } from "vue";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { useGateActions } from "@/composables/useGateActions";
import { withTimeout } from "@/shared/async/withTimeout";

/** How long a Data read waits for the phone before it says so in plain words. */
export const DATA_READ_TIMEOUT_MS = 10_000;

/**
 * Whether the app a Data tab reads is on screen. While it is in the background (or another
 * WebView is on screen) Android may freeze it, so reads wait instead of timing out, writes are
 * held, and the tab offers to bring the app to the front. Reads run again when it returns.
 */
export function useDataPresence() {
  const presence = useTargetPresenceStore();
  const gate = useGateActions();

  const away = computed<string | null>(() => {
    if (presence.presence === "background") {
      return "The app is in the background, so the phone cannot answer. Bring it to the front.";
    }
    if (presence.presence === "view-hidden") {
      return "Another screen of the app is showing, so this page cannot answer. Bring it to the front.";
    }
    return null;
  });

  const bringing = computed(() => gate.running.value === "bring-to-front");

  function bringToFront() {
    return gate.run("bring-to-front", "Bring app to front");
  }

  return { away, bringing, bringToFront };
}

/** Rejects with a plain sentence when the phone does not answer within `ms`. */
export function withReadTimeout<T>(task: Promise<T>, ms = DATA_READ_TIMEOUT_MS): Promise<T> {
  return withTimeout(task, ms, "The phone did not answer");
}
