// @vitest-environment happy-dom
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useTargetsStore } from "../targets.store";
import { useThisPcBrowserStore } from "../thisPcBrowser.store";
import { installMemoryStorage } from "@/test/memory-storage";
import type { CDPTarget } from "@/types/cdp.types";

const phonePage: CDPTarget = {
  id: "adb-1",
  type: "page",
  title: "App",
  url: "https://app.test",
  source: "adb",
  deviceSerial: "r4geda5p7d65u8uo",
};

describe("thisPcBrowser store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installMemoryStorage();
  });

  test("picking This PC with no page open shows a New tab", () => {
    const browser = useThisPcBrowserStore();
    expect(browser.active).toBe(false);
    browser.enter();
    expect(browser.active).toBe(true);
    expect(browser.showingNewTab).toBe(true);
  });

  test("each page on This PC is a tab, and selecting one closes the New tab", async () => {
    const targets = useTargetsStore();
    const browser = useThisPcBrowserStore();
    browser.openNewTab();
    const page = targets.createLocalTarget("http://localhost:5181/panels");
    await nextTick();
    expect(browser.tabs.map((tab) => tab.id)).toEqual([page.id]);
    expect(browser.selectedTab?.id).toBe(page.id);
    expect(browser.showingNewTab).toBe(false);
  });

  test("selecting a phone's page leaves This PC", async () => {
    const targets = useTargetsStore();
    const browser = useThisPcBrowserStore();
    browser.enter();
    targets.selectTarget(phonePage);
    await nextTick();
    expect(browser.active).toBe(false);
  });

  test("closing the last tab keeps This PC, on a New tab", async () => {
    const targets = useTargetsStore();
    const browser = useThisPcBrowserStore();
    const page = targets.createLocalTarget("http://localhost:5181/panels");
    await nextTick();
    targets.selectTarget(null);
    targets.removeTarget(page.id);
    await nextTick();
    expect(browser.active).toBe(true);
    expect(browser.showingNewTab).toBe(true);
  });

  test("saves the tabs at their live address, but only once the restore has read them", async () => {
    localStorage.setItem(
      "capubridge:this-pc-tabs",
      JSON.stringify({ urls: ["http://localhost:5181/old"], selected: 0, active: true }),
    );
    const targets = useTargetsStore();
    const browser = useThisPcBrowserStore();
    const page = targets.createLocalTarget("http://localhost:5173/");
    await nextTick();
    expect(JSON.parse(localStorage.getItem("capubridge:this-pc-tabs") ?? "{}").urls).toEqual([
      "http://localhost:5181/old",
    ]);
    expect(browser.takeSaved().urls).toEqual(["http://localhost:5181/old"]);
    browser.notePage(page.id, { url: "http://localhost:5173/settings", title: "S", icon: null });
    await nextTick();
    expect(JSON.parse(localStorage.getItem("capubridge:this-pc-tabs") ?? "{}")).toEqual({
      urls: ["http://localhost:5173/settings"],
      selected: 0,
      active: true,
    });
  });

  test("a tab's live page is noted and forgotten with it", () => {
    const browser = useThisPcBrowserStore();
    browser.notePage("t1", { url: "http://localhost:5181/a", title: "A", icon: null });
    expect(browser.pages.t1?.title).toBe("A");
    browser.forgetPage("t1");
    expect(browser.pages.t1).toBeUndefined();
  });
});
