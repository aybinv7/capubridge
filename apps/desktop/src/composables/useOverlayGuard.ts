import { onMounted, onUnmounted } from "vue";
import { useLocalWebviewStore } from "@/stores/localWebview.store";

const OVERLAY_SELECTOR = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  "[data-reka-popper-content-wrapper]",
  "[data-overlay]",
  ".cladd-dialog",
  ".cladd-popup",
  ".cladd-popover",
].join(",");

function isBlockingOverlay(element: Element): boolean {
  if (element.matches('[role="tooltip"]') || element.querySelector('[role="tooltip"]')) {
    return false;
  }
  return element.matches(OVERLAY_SELECTOR) || element.querySelector(OVERLAY_SELECTOR) !== null;
}

export function hasBlockingOverlay(root: HTMLElement): boolean {
  for (const child of Array.from(root.children)) {
    if (child.id === "app") {
      continue;
    }
    if (isBlockingOverlay(child)) {
      return true;
    }
  }
  return false;
}

/**
 * Native local-preview webviews always paint above the DOM, so any portalled
 * overlay (dialog, menu, listbox, popover, palette) would render underneath.
 * Observes body-level portals and holds the webview modal guard while one is open.
 */
export function useOverlayGuard(): void {
  const store = useLocalWebviewStore();
  let held = false;
  let frame = 0;
  let observer: MutationObserver | null = null;

  function sync() {
    frame = 0;
    const active = hasBlockingOverlay(document.body);
    if (active && !held) {
      held = true;
      store.acquireModalGuard();
    } else if (!active && held) {
      held = false;
      store.releaseModalGuard();
    }
  }

  function schedule() {
    if (frame === 0) {
      frame = requestAnimationFrame(sync);
    }
  }

  onMounted(() => {
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true });
    sync();
  });

  onUnmounted(() => {
    observer?.disconnect();
    observer = null;
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (held) {
      held = false;
      store.releaseModalGuard();
    }
  });
}
