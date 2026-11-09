import { useCDP } from "@/composables/useCDP";
import { useTargetActivation } from "@/composables/useTargetActivation";
import { readLocalPageIdentity } from "@/components/device-manager/readLocalPageIdentity";
import { useLocalPageHistoryStore } from "@/stores/localPageHistory.store";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import { useTargetsStore } from "@/stores/targets.store";
import type { CDPTarget } from "@/types/cdp.types";

/**
 * Opens a URL as a page on This PC and makes it the active target, remembering it in the page
 * history with the title and icon it reports. A URL already open is selected again, not reopened.
 */
export function useOpenLocalPage(activate?: (target: CDPTarget) => Promise<void>) {
  const targetsStore = useTargetsStore();
  const localWebviewStore = useLocalWebviewStore();
  const pageHistory = useLocalPageHistoryStore();
  const { activateTarget } = useTargetActivation();
  const { connectToTarget } = useCDP();
  const select = activate ?? activateTarget;

  async function learnPageIdentity(target: CDPTarget, url: string) {
    try {
      const ready = await localWebviewStore.ensureCdpTarget(target);
      const client = await connectToTarget(ready);
      pageHistory.describe(url, await readLocalPageIdentity(client));
    } catch (error) {
      console.warn("Could not read the title and icon of the local page", url, error);
    }
  }

  async function openLocalPage(url: string): Promise<CDPTarget> {
    const target = targetsStore.createLocalTarget(url);
    pageHistory.record(url);
    await select(target);
    void learnPageIdentity(target, url);
    return target;
  }

  return { openLocalPage };
}
