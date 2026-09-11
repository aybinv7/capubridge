import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

/**
 * Progress of an element through the viewport as 0..1: 0 while its top edge is
 * still below the fold, 1 once it has risen to the settle line. Sampled once
 * per frame so scroll-driven transforms stay on the compositor.
 */
export function useElementReveal(target: Ref<HTMLElement | null>, settleRatio = 0.62) {
  const progress = ref(0);
  let frame = 0;
  let observer: IntersectionObserver | undefined;
  let active = false;

  const sample = () => {
    frame = 0;
    const el = target.value;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const start = window.innerHeight;
    const end = window.innerHeight * settleRatio - rect.height * 0.25;
    const span = start - end;
    const raw = span > 0 ? (start - rect.top) / span : 1;
    progress.value = Math.min(1, Math.max(0, raw));
  };

  const onScroll = () => {
    if (frame || !active) return;
    frame = window.requestAnimationFrame(sample);
  };

  onMounted(() => {
    observer = new IntersectionObserver(
      (entries) => {
        active = entries.some((entry) => entry.isIntersecting);
        if (active) sample();
      },
      { rootMargin: "20% 0px 20% 0px" },
    );
    if (target.value) observer.observe(target.value);

    sample();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  });

  onBeforeUnmount(() => {
    if (frame) window.cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  });

  return { progress };
}
