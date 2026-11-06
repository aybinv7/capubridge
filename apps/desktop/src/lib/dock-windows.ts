import type { DockTab } from "@/types/dock.types";

/** Window label of a popped-out dock tab. */
export function dockWindowLabel(tab: DockTab): string {
  return `dock-${tab}`;
}

/** Whether the pop-out window of `tab` exists right now. */
export async function isDockWindowOpen(tab: DockTab): Promise<boolean> {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  return (await WebviewWindow.getByLabel(dockWindowLabel(tab))) !== null;
}
