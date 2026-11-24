import { AppPause } from "@capubridge/cdp-protocol";
import { toast } from "@/lib/toast";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";

/** What pausing the app costs, said in every question that pauses it. */
export const PAUSE_COST =
  "The app holds it open, so the page reloads with the app paused, the change is made, then the app starts again. What the app keeps only in memory (an unsaved form, the screen it is on) is lost; what it stored stays.";

/**
 * Pauses the app on the selected page around work that needs its OPFS files released (see
 * `AppPause`). Says so when the app could not be started again.
 */
export function useAppPause() {
  const { getClient } = useCDP();
  const targets = useTargetsStore();

  /** The page's DevTools socket, for the Rust commands that write while the app is paused. */
  function wsUrl(): string {
    const url = targets.selectedTarget?.webSocketDebuggerUrl;
    if (!url) throw new Error("No page is selected");
    return url;
  }

  /** The page being debugged now, to check a database still belongs to it. */
  function targetId(): string {
    return targets.cdpTargetId;
  }

  async function paused<T>(work: (origin: string) => Promise<T>): Promise<T> {
    const client = getClient(targets.cdpTargetId);
    if (!client) throw new Error("The page is not connected");
    const outcome = await new AppPause(client).run(work);
    if (!outcome.restarted) {
      toast.warning("The app did not start again", {
        description: "Reload the page from the toolbar, or open the app again on the phone.",
      });
    }
    return outcome.value;
  }

  return { paused, wsUrl, targetId };
}
