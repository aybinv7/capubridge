import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useDrawerStore } from "@/stores/drawer.store";
import { installMemoryStorage } from "@/test/memory-storage";

describe("drawer store", () => {
  beforeEach(() => {
    installMemoryStorage();
    setActivePinia(createPinia());
  });

  it("opens where the old dock was", () => {
    localStorage.setItem(
      "capubridge:dock",
      JSON.stringify({ isOpen: true, activeTab: "exceptions", heightPx: 300 }),
    );
    const drawer = useDrawerStore();
    expect(drawer.isOpen).toBe(true);
    expect(drawer.view).toBe("console");
    expect(drawer.heightPx).toBe(300);
  });

  it("counts warnings only while their view is out of sight", () => {
    const drawer = useDrawerStore();
    drawer.noteArrivals("logs", 3);
    drawer.noteArrivals("console", 2);
    expect(drawer.unreadTotal).toBe(5);
    drawer.open("logs");
    expect(drawer.unread.logs).toBe(0);
    drawer.noteArrivals("logs", 4);
    expect(drawer.unread.logs).toBe(0);
    drawer.setView("console");
    expect(drawer.unread.console).toBe(0);
  });

  it("keeps a popped-out view out of the drawer and closes when nothing is left", () => {
    const drawer = useDrawerStore();
    drawer.open("logs");
    drawer.setPoppedOut("logs", true);
    expect(drawer.currentView).toBe("console");
    drawer.noteArrivals("logs", 2);
    expect(drawer.unread.logs).toBe(0);
    drawer.setPoppedOut("console", true);
    expect(drawer.isOpen).toBe(false);
    drawer.setPoppedOut("logs", false);
    expect(drawer.docked).toEqual(["logs"]);
  });

  it("opens the console in Errors mode for an exceptions request", () => {
    const drawer = useDrawerStore();
    drawer.open("console", { mode: "errors" });
    expect(drawer.consoleMode).toBe("errors");
    expect(drawer.currentView).toBe("console");
  });
});
