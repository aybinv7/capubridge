import { drawerViewFor, type ConsoleMode, type DrawerView } from "@/types/drawer.types";

export const drawerOpenEventName = "capubridge:drawer-open";

const OPEN_REQUEST_KEY = "capubridge:drawer-open-request";

/** What a route asked the drawer to show. */
export interface DrawerOpenRequest {
  view: DrawerView;
  mode?: ConsoleMode;
}

/** The request for a `/console/:tab?` route; older tab names still land on the right view. */
export function drawerRequestFor(tab: string | undefined): DrawerOpenRequest {
  return drawerViewFor(tab) ?? { view: "logs" };
}

/** Keeps a request made before the shell mounted, so it is shown once it does. */
export function queueDrawerOpenRequest(request: DrawerOpenRequest) {
  try {
    window.sessionStorage.setItem(OPEN_REQUEST_KEY, JSON.stringify(request));
  } catch (error) {
    console.warn("Could not keep the console open request", error);
  }
}

export function takeDrawerOpenRequest(): DrawerOpenRequest | null {
  try {
    const raw = window.sessionStorage.getItem(OPEN_REQUEST_KEY);
    window.sessionStorage.removeItem(OPEN_REQUEST_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as { view?: unknown; mode?: unknown };
    const found = drawerViewFor(typeof candidate.view === "string" ? candidate.view : null);
    if (!found) return null;
    return candidate.mode === "errors" ? { ...found, mode: "errors" } : found;
  } catch (error) {
    console.warn("Could not read the console open request", error);
    return null;
  }
}

export function dispatchDrawerOpenRequest(request: DrawerOpenRequest) {
  window.dispatchEvent(
    new CustomEvent<DrawerOpenRequest>(drawerOpenEventName, { detail: request }),
  );
}
