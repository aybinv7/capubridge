import { toast } from "@/lib/toast";
import { useOpenLocalPage } from "@/composables/useOpenLocalPage";
import { useTargetActivation } from "@/composables/useTargetActivation";
import { useConnectionStore } from "@/stores/connection.store";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useThisPcBrowserStore } from "@/stores/thisPcBrowser.store";
import type { CDPTarget } from "@/types/cdp.types";

/**
 * The tabs of This PC: switching to one makes Data, Network and Elements follow it, closing the
 * open one moves to its neighbour, and closing the last leaves a New Tab page, still on This PC.
 */
export function useLocalTabs() {
  const browser = useThisPcBrowserStore();
  const targetsStore = useTargetsStore();
  const connectionStore = useConnectionStore();
  const localWebviewStore = useLocalWebviewStore();
  const mirrorStore = useMirrorStore();
  const { activateTarget } = useTargetActivation();
  const { openLocalPage } = useOpenLocalPage();

  function enterThisPc() {
    browser.enter();
    mirrorStore.open();
  }

  /** A phone was picked: its screen replaces the tabs, which stay open for later. */
  function leaveThisPc() {
    browser.leave();
    if (targetsStore.selectedTarget?.source === "local") targetsStore.selectTarget(null);
  }

  async function selectTab(target: CDPTarget) {
    browser.closeNewTab();
    if (targetsStore.selectedTarget?.id === target.id) return;
    try {
      await activateTarget(target);
    } catch (error) {
      toast.error("Could not switch to the tab", { description: String(error) });
    }
  }

  function openNewTab() {
    browser.openNewTab();
    mirrorStore.open();
  }

  async function openInNewTab(url: string) {
    try {
      await openLocalPage(url);
      browser.closeNewTab();
    } catch (error) {
      toast.error("Could not open the page", { description: String(error) });
    }
  }

  async function leaveSelected(target: CDPTarget, tabs: readonly CDPTarget[]) {
    const index = tabs.findIndex((tab) => tab.id === target.id);
    const neighbour = tabs[index + 1] ?? tabs[index - 1] ?? null;
    if (neighbour) {
      await activateTarget(neighbour);
      return;
    }
    await connectionStore.disconnectTarget(target.id);
    targetsStore.selectTarget(null);
    browser.openNewTab();
  }

  async function closeTab(target: CDPTarget) {
    try {
      if (targetsStore.selectedTarget?.id === target.id) {
        await leaveSelected(target, browser.tabs);
      }
      await localWebviewStore.closeTarget(target);
      targetsStore.removeTarget(target.id);
      browser.forgetPage(target.id);
    } catch (error) {
      toast.error("Could not close the tab", { description: String(error) });
    }
  }

  return { enterThisPc, leaveThisPc, selectTab, openNewTab, openInNewTab, closeTab };
}
