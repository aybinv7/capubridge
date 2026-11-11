import { onUnmounted, watch, type Ref } from "vue";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import type { Webview } from "@tauri-apps/api/webview";
import { useBoundsFollower } from "@/composables/useBoundsFollower";
import { invokeCommand } from "@/runtime/ipc/client";
import { useLocalWebviewStore } from "@/stores/localWebview.store";

/** One DevTools view for every tab: switching tabs points it at the next page instead of opening another. */
const LABEL = "local-preview-devtools";

let view: Promise<Webview> | null = null;
let shownUrl: string | null = null;

async function createView(url: string): Promise<Webview> {
  await invokeCommand("local_devtools_create", { label: LABEL, url });
  const { Webview: WebviewApi } = await import("@tauri-apps/api/webview");
  const webview = await WebviewApi.getByLabel(LABEL);
  if (!webview) throw new Error("DevTools opened, but its view could not be found");
  shownUrl = url;
  return webview;
}

function viewFor(url: string): Promise<Webview> {
  view ??= createView(url).catch((error: unknown) => {
    view = null;
    throw error;
  });
  return view;
}

async function park() {
  if (!view) return;
  let webview: Webview;
  try {
    webview = await view;
  } catch (error) {
    console.warn("DevTools never opened, so there is nothing to hide", error);
    return;
  }
  try {
    await webview.setSize(new LogicalSize(1, 1));
    await webview.setPosition(new LogicalPosition(-32000, -32000));
  } catch (error) {
    console.warn("Could not move DevTools aside", error);
  }
  await webview.hide().catch((error: unknown) => {
    console.warn("Could not hide DevTools", error);
  });
}

/**
 * Lays the page's own DevTools over `host`, a native view in the preview environment like the
 * page itself, so it never reaches Capubridge's windows. It follows the host as it moves, steps
 * aside while a dialog or menu is open (native views paint above them), and hides when the host
 * leaves; it stays loaded for the way back.
 */
export function useLocalDevtoolsView(
  host: Readonly<Ref<HTMLElement | null>>,
  url: Readonly<Ref<string | null>>,
  onError: (message: string) => void,
) {
  const localWebviewStore = useLocalWebviewStore();

  async function place() {
    const element = host.value;
    const next = url.value;
    const rect = element?.getBoundingClientRect();
    if (!element || !next || !rect || rect.width < 2 || rect.height < 2) {
      await park();
      return;
    }
    if (localWebviewStore.modalGuardCount > 0) {
      await park();
      return;
    }
    try {
      const webview = await viewFor(next);
      if (shownUrl !== next) {
        await invokeCommand("local_webview_navigate", { label: LABEL, url: next });
        shownUrl = next;
      }
      await invokeCommand("local_webview_set_bounds", {
        label: LABEL,
        x: Math.max(0, Math.round(rect.left)),
        y: Math.max(0, Math.round(rect.top)),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
      if (localWebviewStore.modalGuardCount > 0) {
        await park();
        return;
      }
      await webview.show();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }

  const follower = useBoundsFollower(host, place);

  watch(
    [url, () => localWebviewStore.modalGuardCount, () => localWebviewStore.layoutRevision],
    () => follower.invalidate(),
  );

  onUnmounted(() => {
    void park();
  });
}
