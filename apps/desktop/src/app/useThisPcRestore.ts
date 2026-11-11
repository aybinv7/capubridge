import { useLocalTabs } from "@/composables/useLocalTabs";
import { useTargetActivation } from "@/composables/useTargetActivation";
import { savedSelection } from "@/lib/this-pc-session";
import { useTargetsStore } from "@/stores/targets.store";
import { useThisPcBrowserStore } from "@/stores/thisPcBrowser.store";

/**
 * Brings back the tabs of This PC from the last run, at the address each was showing. Only the tab
 * that was open is loaded; the others load when picked. This PC becomes the context again only if
 * it was when Capubridge closed.
 */
export function useThisPcRestore() {
  const browser = useThisPcBrowserStore();
  const targetsStore = useTargetsStore();
  const { activateTarget } = useTargetActivation();
  const { enterThisPc } = useLocalTabs();

  async function restoreThisPc() {
    const saved = browser.takeSaved();
    const tabs = saved.urls.map((url) => targetsStore.addLocalTarget(url));
    if (!saved.active) return;
    const selectedUrl = savedSelection(saved);
    const selected = selectedUrl ? tabs.find((tab) => tab.url === selectedUrl) : undefined;
    if (!selected) {
      enterThisPc();
      return;
    }
    try {
      await activateTarget(selected);
    } catch (error) {
      console.warn("Could not reopen the last tab on This PC", error);
      enterThisPc();
    }
  }

  return { restoreThisPc };
}
