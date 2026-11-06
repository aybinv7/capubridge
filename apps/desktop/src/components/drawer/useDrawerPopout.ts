import { onScopeDispose } from "vue";
import { toast } from "vue-sonner";
import { listenEvent } from "@/runtime/ipc/client";
import { useDrawerStore } from "@/stores/drawer.store";
import { drawerViewIds, type DrawerView } from "@/types/drawer.types";
import { DRAWER_WINDOW_LABEL } from "./drawerViews";

/**
 * Main window side of the pop-out: Logs and Console leave together for one window of their own
 * (or focus it when it exists), come back together when that window closes, and reopen the
 * drawer on the view the window was showing when it asks to return. Capture stays app-level,
 * so the window is one more view of the same streams.
 */
export function useDrawerPopout() {
  const drawer = useDrawerStore();
  let stopReturn: (() => void) | null = null;
  let disposed = false;

  function setAllPoppedOut(popped: boolean) {
    for (const view of drawerViewIds) drawer.setPoppedOut(view, popped);
  }

  listenEvent("capubridge:drawer-return", ({ view }) => {
    setAllPoppedOut(false);
    drawer.open(view);
  })
    .then((unlisten) => {
      if (disposed) unlisten();
      else stopReturn = unlisten;
    })
    .catch((error: unknown) => {
      toast.error("The console window cannot come back by itself", {
        description: String(error),
      });
    });

  async function popOut(view: DrawerView) {
    setAllPoppedOut(true);
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const existing = await WebviewWindow.getByLabel(DRAWER_WINDOW_LABEL);
      if (existing) {
        await existing.show();
        await existing.setFocus();
        return;
      }
      const created = new WebviewWindow(DRAWER_WINDOW_LABEL, {
        url: `/?drawer=${view}`,
        title: "Console · Capubridge",
        width: 1040,
        height: 520,
        minWidth: 640,
        minHeight: 260,
        resizable: true,
        decorations: false,
      });
      void created.once("tauri://destroyed", () => setAllPoppedOut(false));
      void created.once("tauri://error", () => {
        setAllPoppedOut(false);
        toast.error("Could not open the console in its own window");
      });
    } catch (error) {
      setAllPoppedOut(false);
      toast.error("Could not open the console in its own window", {
        description: String(error),
      });
    }
  }

  onScopeDispose(() => {
    disposed = true;
    stopReturn?.();
  });

  return { popOut };
}
