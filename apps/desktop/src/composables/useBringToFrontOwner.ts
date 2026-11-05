import { computed } from "vue";
import { useRoute } from "vue-router";
import { useMirrorStore } from "@/stores/mirror.store";

/** Where the one "Bring to front" button lives while the app is in the background. */
export type BringToFrontOwner = "route" | "screen" | "strip";

/**
 * One call to action per view: a screen that offers its own "Bring to front" (route meta
 * `ownsBringToFront`) keeps it, else the phone column shows it over the live screen, else the
 * gate strip does. Every other place only says the app is in the background.
 */
export function useBringToFrontOwner() {
  const route = useRoute();
  const mirror = useMirrorStore();
  return computed<BringToFrontOwner>(() => {
    if (route.meta.ownsBringToFront) return "route";
    if (mirror.isOpen && mirror.isStreaming && !mirror.isDetached) return "screen";
    return "strip";
  });
}
