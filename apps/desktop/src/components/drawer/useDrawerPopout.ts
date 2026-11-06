import { onScopeDispose } from "vue";
import { toast } from "vue-sonner";
import { listenEvent } from "@/runtime/ipc/client";
import { useDrawerStore } from "@/stores/drawer.store";
import type { DrawerView } from "@/types/drawer.types";
import { DRAWER_VIEW_META, drawerWindowLabel } from "./drawerViews";

/**
 * Main window side of pop-outs: opens a view in a window of its own (or focuses the one that
 * exists), takes it back when that window closes, and reopens the drawer on it when the window
 * asks to return. Capture stays app-level, so a pop-out is one more view of the same streams.
 */
export function useDrawerPopout() {
  const drawer = useDrawerStore();
  let stopReturn: (() => void) | null = null;
  let disposed = false;

  listenEvent("capubridge:drawer-return", ({ view }) => {
    drawer.setPoppedOut(view, false);
    drawer.open(view);
  })
    .then((unlisten) => {
      if (disposed) unlisten();
      else stopReturn = unlisten;
    })
    .catch((error: unknown) => {
      toast.error("Views in their own window cannot come back by themselves", {
        description: String(error),
      });
    });

  async function popOut(view: DrawerView) {
    const meta = DRAWER_VIEW_META[view];
    drawer.setPoppedOut(view, true);
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const label = drawerWindowLabel(view);
      const existing = await WebviewWindow.getByLabel(label);
      if (existing) {
        await existing.show();
        await existing.setFocus();
        return;
      }
      const created = new WebviewWindow(label, {
        url: `/?drawer=${view}`,
        title: `${meta.label} · Capubridge`,
        width: 960,
        height: 420,
        minWidth: 640,
        minHeight: 220,
        resizable: true,
        decorations: false,
      });
      void created.once("tauri://destroyed", () => drawer.setPoppedOut(view, false));
      void created.once("tauri://error", () => {
        drawer.setPoppedOut(view, false);
        toast.error(`Could not open ${meta.label} in its own window`);
      });
    } catch (error) {
      drawer.setPoppedOut(view, false);
      toast.error(`Could not open ${meta.label} in its own window`, {
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
