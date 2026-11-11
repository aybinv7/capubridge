import { ArrowLeftToLine, ArrowRightToLine, Plus, X } from "lucide-vue-next";
import { useRoute } from "vue-router";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useLocalTabs } from "@/composables/useLocalTabs";
import { useThisPcBrowserStore } from "@/stores/thisPcBrowser.store";

/**
 * Browser keys for the tabs of This PC: Ctrl+T, Ctrl+W, Ctrl+Tab and Ctrl+Shift+Tab. On Data ›
 * SQLite, Ctrl+T and Ctrl+W keep opening and closing its query tabs, the more local meaning.
 */
export function useThisPcCommands() {
  const browser = useThisPcBrowserStore();
  const route = useRoute();
  const { openNewTab, closeTab, selectTab } = useLocalTabs();

  const onSqlite = () => String(route.name ?? "").startsWith("storage-sqlite");
  const open = () => browser.active;

  function step(offset: number) {
    const tabs = browser.tabs;
    if (!tabs.length) return;
    const index = tabs.findIndex((tab) => tab.id === browser.selectedTab?.id);
    const next = tabs[(index + offset + tabs.length) % tabs.length];
    if (next) void selectTab(next);
  }

  useCommandProvider("this-pc.tabs", () => [
    {
      id: "this-pc.new-tab",
      title: "New tab on This PC",
      group: "Targets" as const,
      icon: Plus,
      binding: "mod+t",
      keywords: ["open", "page", "url", "browser"],
      when: () => open() && !onSqlite(),
      run: openNewTab,
    },
    {
      id: "this-pc.close-tab",
      title: "Close the tab",
      group: "Targets" as const,
      icon: X,
      binding: "mod+w",
      keywords: ["page", "browser"],
      when: () => open() && !onSqlite() && !browser.showingNewTab && !!browser.selectedTab,
      run: () => {
        const tab = browser.selectedTab;
        if (tab) void closeTab(tab);
      },
    },
    {
      id: "this-pc.next-tab",
      title: "Next tab",
      group: "Targets" as const,
      icon: ArrowRightToLine,
      binding: "mod+tab",
      when: () => open() && browser.tabs.length > 1,
      run: () => step(1),
    },
    {
      id: "this-pc.previous-tab",
      title: "Previous tab",
      group: "Targets" as const,
      icon: ArrowLeftToLine,
      binding: "mod+shift+tab",
      when: () => open() && browser.tabs.length > 1,
      run: () => step(-1),
    },
  ]);
}
