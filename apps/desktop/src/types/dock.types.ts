export const dockTabIds = ["assistant", "logcat", "repl", "console", "exceptions"] as const;

export type DockTab = (typeof dockTabIds)[number];

export function isDockTab(value: string | null | undefined): value is DockTab {
  return typeof value === "string" && dockTabIds.includes(value as DockTab);
}
