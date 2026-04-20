import type { DockTab } from "@/types/dock.types";
import { isDockTab } from "@/types/dock.types";

export const dockOpenEventName = "capubridge:dock-open";

const dockOpenStorageKey = "capubridge:dock-open-request";

export function queueDockOpenRequest(tab: DockTab) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(dockOpenStorageKey, tab);
}

export function readDockOpenRequest(): DockTab | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.sessionStorage.getItem(dockOpenStorageKey);
  return isDockTab(value) ? value : null;
}

export function clearDockOpenRequest() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(dockOpenStorageKey);
}

export function dispatchDockOpenRequest(tab: DockTab) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<{ tab: DockTab }>(dockOpenEventName, {
      detail: { tab },
    }),
  );
}
