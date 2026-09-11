import { onBeforeUnmount, onMounted, ref } from "vue";

/** Document scroll position as 0..1, sampled once per frame. */
export function useScrollProgress() {
  const progress = ref(0);
  let frame = 0;

  const sample = () => {
    frame = 0;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    progress.value = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;
  };

  const onScroll = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(sample);
  };

  onMounted(() => {
    sample();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  });

  onBeforeUnmount(() => {
    if (frame) window.cancelAnimationFrame(frame);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  });

  return { progress };
}
