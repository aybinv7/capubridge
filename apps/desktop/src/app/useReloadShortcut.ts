import { onMounted, onUnmounted } from "vue";

function isReload(event: KeyboardEvent): boolean {
  if (event.key === "F5") return !event.altKey;
  const mod = event.ctrlKey || event.metaKey;
  return mod && !event.altKey && event.key.toLowerCase() === "r";
}

/**
 * F5 and Ctrl+R reload the window. WebView2's own shortcuts are off, and this one stays outside
 * the command palette on purpose, so a reload still works when the app's state has gone wrong.
 */
export function useReloadShortcut() {
  function onKeydown(event: KeyboardEvent) {
    if (!isReload(event)) return;
    event.preventDefault();
    window.location.reload();
  }

  onMounted(() => window.addEventListener("keydown", onKeydown, { capture: true }));
  onUnmounted(() => window.removeEventListener("keydown", onKeydown, { capture: true }));
}
