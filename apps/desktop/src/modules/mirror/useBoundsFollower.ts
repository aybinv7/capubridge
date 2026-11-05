import { onMounted, onUnmounted, type Ref } from "vue";

/**
 * Calls `apply` whenever the element's box moves or resizes, checked once per frame, so a native
 * view laid over it keeps up with slides, drags and reflows that a ResizeObserver never reports.
 * Placements never overlap: a change that lands while one is in flight is applied right after.
 */
export function useBoundsFollower(
  element: Readonly<Ref<HTMLElement | null>>,
  apply: () => Promise<void>,
) {
  let frame = 0;
  let lastKey = "";
  let inFlight = false;
  let dirty = false;

  async function place() {
    if (inFlight) {
      dirty = true;
      return;
    }
    inFlight = true;
    try {
      await apply();
    } catch (error) {
      console.warn("Failed to place the local preview", error);
    } finally {
      inFlight = false;
      if (dirty) {
        dirty = false;
        void place();
      }
    }
  }

  function tick() {
    frame = requestAnimationFrame(tick);
    const target = element.value;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const key = `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}`;
    if (key === lastKey) return;
    lastKey = key;
    void place();
  }

  onMounted(() => {
    frame = requestAnimationFrame(tick);
  });

  onUnmounted(() => {
    cancelAnimationFrame(frame);
  });

  return {
    /** Forces the next frame to place the view again, after it was shown or re-attached. */
    invalidate() {
      lastKey = "";
    },
  };
}
