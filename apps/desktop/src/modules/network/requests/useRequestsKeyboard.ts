import type { Ref } from "vue";
import { useEventListener } from "@vueuse/core";
import { ownsKeys } from "@/shared/list/keyTargets";

interface RequestsKeyHandlers {
  details: Ref<HTMLElement | null>;
  hasSelection: () => boolean;
  focusFilter: () => void;
  findInDetails: () => void;
  move: (step: number) => void;
  cycleTab: (step: number) => void;
}

/**
 * Screen keys for Requests: Ctrl+F finds inside the details when focus is there and filters the
 * list otherwise; Ctrl+↑/↓ steps through requests and Ctrl+←/→ through the details tabs, both
 * outside text fields.
 */
export function useRequestsKeyboard(handlers: RequestsKeyHandlers) {
  useEventListener(document, "keydown", (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    const target = event.target instanceof Node ? event.target : null;

    if (event.key === "f" || event.key === "F") {
      event.preventDefault();
      if (target && handlers.details.value?.contains(target)) handlers.findInDetails();
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
