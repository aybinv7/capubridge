import { computed, type ComputedRef } from "vue";
import { useMediaQuery } from "@/composables/useMediaQuery";
import { useReducedMotion } from "@/composables/useReducedMotion";

/**
 * One gate for effects whose cost is paid every frame rather than once:
 * the WebGL thread field and the stacked backdrop-filter edges.
 *
 * A phone loses on all three counts at once - it has the weakest GPU, the
 * highest device pixel ratio to fill, and the compositor is already busy
 * driving touch scroll - so the honest answer there is to draw the cheap
 * version rather than a throttled version of the expensive one.
 */
const DESKTOP_VIEWPORT = "(min-width: 1024px)";
const FINE_POINTER = "(pointer: fine)";
const MIN_CORES = 4;

const hasSpareCores = () =>
  typeof navigator === "undefined" || (navigator.hardwareConcurrency ?? MIN_CORES) >= MIN_CORES;

export function useHeavyEffects(): { heavyEffectsAllowed: ComputedRef<boolean> } {
  const isDesktopViewport = useMediaQuery(DESKTOP_VIEWPORT);
  const hasFinePointer = useMediaQuery(FINE_POINTER);
  const { reduced } = useReducedMotion();
  const cores = hasSpareCores();

  const heavyEffectsAllowed = computed(
    () => !reduced.value && cores && isDesktopViewport.value && hasFinePointer.value,
  );

  return { heavyEffectsAllowed };
}
