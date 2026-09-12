import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";

/**
 * Progress through a tall, sticky-pinned section as 0..1, where 0 is the
 * moment the section pins and 1 is the moment it releases.
 *
 * The element's geometry is measured off the scroll path and cached, because
 * reading a rect inside a scroll handler forces the browser to flush layout
 * that the previous frame's style write had just invalidated - a read/write
 * cycle Lighthouse reports as a forced reflow. Scrolling now touches nothing
 * but `scrollY`, which is a cached scalar.
 *
 * A ResizeObserver on the element and on the body keeps the cache honest:
 * anything above the section that settles later - a late font, a lazy image -
 * changes the body's height and triggers a fresh measure, so the offset can
 * never go stale.
 */
export function useScrollSequence(target: Ref<HTMLElement | null>) {
  const progress = ref(0);

  let top = 0;
  let height = 0;
  let viewport = 0;
  let observer: ResizeObserver | undefined;

  const update = () => {
    const travel = height - viewport;
    if (travel <= 0) {
      progress.value = 0;
      return;
    }

    progress.value = Math.min(1, Math.max(0, (window.scrollY - top) / travel));
  };

  const measure = () => {
    const el = target.value;
    if (!el) {
      top = 0;
      height = 0;
      progress.value = 0;
      return;
    }

    const rect = el.getBoundingClientRect();
    top = rect.top + window.scrollY;
    height = rect.height;
    viewport = window.innerHeight;
    update();
  };

  const observe = () => {
    observer?.disconnect();
    if (typeof ResizeObserver === "undefined") return;

    observer = new ResizeObserver(measure);
    if (target.value) observer.observe(target.value);
    observer.observe(document.body);
  };

  onMounted(() => {
    measure();
    observe();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
  });

  watch(target, () => {
    measure();
    observe();
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", measure);
  });

  return { progress };
}
