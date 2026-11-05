import type { AppAction } from "@/shared/apps/appActions";

/** The lifecycle actions the App route offers: the shared app actions bar uninstall. */
export type LifecycleAction = Extract<AppAction, "forceStop" | "clearData">;

/** Stopping first makes Android start the app from scratch, not resume it. */
export function restartCommand(packageName: string): string {
  return `am force-stop ${packageName}`;
}

/** The word on the open button: a running app in the background is brought forward. */
export function openLabel(inBackground: boolean): string {
  return inBackground ? "Bring to front" : "Open";
}
