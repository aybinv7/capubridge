import type { Ref } from "vue";
import { useEventListener } from "@vueuse/core";
import { ownsKeys } from "@/shared/list/keyTargets";

interface RequestsKeyHandlers {
  root: Ref<HTMLElement | null>;
  details: Ref<HTMLElement | null>;
  detailsHasFind: () => boolean;
  hasSelection: () => boolean;
  focusFilter: () => void;
  findInDetails: () => void;
  move: (step: number) => void;
  cycleTab: (step: number) => void;
}

/** Whether a key press belongs to Requests: it came from inside it, or from nowhere in particular. */
function isOurs(root: HTMLElement | null, target: EventTarget | null): boolean {
  if (!root) return false;
  if (!(target instanceof Node)) return true;
  return root.contains(target) || target === document.body || target === document.documentElement;
}

/**
 * Screen keys for Requests, only for key presses inside the screen (or with nothing focused), so
 * the console, the phone column and dialogs keep their own Ctrl+F. Ctrl+F finds inside the details
 * when focus is there and the open tab can find, and filters the list otherwise; Ctrl+↑/↓ steps
 * through requests and Ctrl+←/→ through the details tabs, both outside text fields.
 */
export function useRequestsKeyboard(handlers: RequestsKeyHandlers) {
  useEventListener(document, "keydown", (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    if (!isOurs(handlers.root.value, event.target)) return;
    const target = event.target instanceof Node ? event.target : null;

    if (event.key === "f" || event.key === "F") {
      event.preventDefault();
      const inDetails = target !== null && handlers.details.value?.contains(target) === true;
      if (inDetails && handlers.detailsHasFind()) handlers.findInDetails();
      else handlers.focusFilter();
      return;
    }

    if (ownsKeys(event.target)) return;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      handlers.move(event.key === "ArrowDown" ? 1 : -1);
    } else if (
      (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
      handlers.hasSelection()
    ) {
      event.preventDefault();
      handlers.cycleTab(event.key === "ArrowRight" ? 1 : -1);
    }
  });
}
