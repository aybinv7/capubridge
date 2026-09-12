import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

/**
 * Progress of an element through the viewport as 0..1: 0 while its top edge is
 * still below the fold, 1 once it has risen to the settle line.
 *
 * Geometry is measured off the scroll path and cached - see useScrollSequence
 * for why. The scroll handler then only reads `scrollY`, so driving a
 * transform from this never forces a layout flush.
 */
export function useElementReveal(target: Ref<HTMLElement | null>, settleRatio = 0.62) {
  const progress = ref(0);

  let top = 0;
  let span = 0;
  let start = 0;
  let active = false;
  let frame = 0;
  let intersection: IntersectionObserver | undefined;
  let resize: ResizeObserver | undefined;

  const update = () => {
    frame = 0;
    if (span <= 0) {
      progress.value = 1;
      return;
    }

    const raw = (start - (top - window.scrollY)) / span;
    progress.value = Math.min(1, Math.max(0, raw));
  };

  const measure = () => {
    const el = target.value;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    top = rect.top + window.scrollY;
    start = window.innerHeight;
    span = start - (window.innerHeight * settleRatio - rect.height * 0.25);
    update();
  };

  const onScroll = () => {
    if (frame || !active) return;
    frame = window.requestAnimationFrame(update);
  };

  onMounted(() => {
    intersection = new IntersectionObserver(
      (entries) => {
        active = entries.some((entry) => entry.isIntersecting);
        if (active) update();
      },
      { rootMargin: "20% 0px 20% 0px" },
    );
    if (target.value) intersection.observe(target.value);

    if (typeof ResizeObserver !== "undefined") {
      resize = new ResizeObserver(measure);
      if (target.value) resize.observe(target.value);
      resize.observe(document.body);
    }

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
  });

  onBeforeUnmount(() => {
    if (frame) window.cancelAnimationFrame(frame);
    intersection?.disconnect();
    resize?.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", measure);
  });

  return { progress };
}
