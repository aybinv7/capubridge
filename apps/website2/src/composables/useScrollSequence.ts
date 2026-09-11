import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

/**
 * Progress through a tall, sticky-pinned section as 0..1, where 0 is the
 * moment the section pins and 1 is the moment it releases.
 *
 * Position is read from the element's own rect on each scroll event rather
 * than cached at mount: anything above the section that settles later - a
 * late font, a lazy image - would otherwise leave a stale offset behind and
 * freeze the sequence. One rect read per scroll is cheap, and keeping
 * requestAnimationFrame out of the path means the sequence still advances
 * wherever frames are throttled.
 */
export function useScrollSequence(target: Ref<HTMLElement | null>) {
  const progress = ref(0);

  const update = () => {
    const el = target.value;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const travel = rect.height - window.innerHeight;
    if (travel <= 0) {
      progress.value = 0;
      return;
    }

    progress.value = Math.min(1, Math.max(0, -rect.top / travel));
  };

  onMounted(() => {
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
  });

  onBeforeUnmount(() => {
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
  });

  return { progress };
}
