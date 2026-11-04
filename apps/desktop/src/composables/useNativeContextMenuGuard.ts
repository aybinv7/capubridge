import { onBeforeUnmount, onMounted } from "vue";
import { isEditableTarget } from "@/lib/commands/editable";

/** Whether the browser's own menu should open: editable fields keep Cut/Copy/Paste. */
export function allowsNativeContextMenu(target: EventTarget | null): boolean {
  return isEditableTarget(target);
}

/**
 * WebView2 opens the browser menu (Back, Refresh, Save as, Print, Inspect) on any
 * right-click the page does not handle. A desktop app never shows it; app menus
 * (Reka context menus) prevent the default themselves and are unaffected.
 */
export function useNativeContextMenuGuard(): void {
  function onContextMenu(event: MouseEvent) {
    if (event.defaultPrevented || allowsNativeContextMenu(event.target)) return;
    event.preventDefault();
  }
  onMounted(() => window.addEventListener("contextmenu", onContextMenu));
  onBeforeUnmount(() => window.removeEventListener("contextmenu", onContextMenu));
}
