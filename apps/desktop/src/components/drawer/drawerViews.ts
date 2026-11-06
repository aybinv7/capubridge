import type { Component } from "vue";
import { ScrollText, SquareTerminal } from "lucide-vue-next";
import type { GateRequirement } from "@/lib/gates/types";
import type { DrawerView } from "@/types/drawer.types";

export interface DrawerViewMeta {
  label: string;
  icon: Component;
  /** What the view needs before it can show anything truthful. */
  requirement: GateRequirement;
}

/** Logs needs a device; Console needs a WebView. Icons match the timeline's lanes. */
export const DRAWER_VIEW_META: Readonly<Record<DrawerView, DrawerViewMeta>> = {
  logs: { label: "Logs", icon: ScrollText, requirement: "device" },
  console: { label: "Console", icon: SquareTerminal, requirement: "target" },
};

/** Window label of a view that lives in a window of its own. */
export function drawerWindowLabel(view: DrawerView): string {
  return `drawer-${view}`;
}

/** Whether the window of `view` exists right now. */
export async function isDrawerWindowOpen(view: DrawerView): Promise<boolean> {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  return (await WebviewWindow.getByLabel(drawerWindowLabel(view))) !== null;
}
