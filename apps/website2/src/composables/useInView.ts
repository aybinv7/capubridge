import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

/** True while the target intersects the viewport, so costly canvases can unmount. */
export function useInView(target: Ref<HTMLElement | null>, rootMargin = "10% 0px 10% 0px") {
  const inView = ref(true);
  let observer: IntersectionObserver | undefined;

  onMounted(() => {
    if (typeof IntersectionObserver === "undefined" || !target.value) return;

    observer = new IntersectionObserver(
      (entries) => {
        inView.value = entries.some((entry) => entry.isIntersecting);
      },
      { rootMargin },
    );
    observer.observe(target.value);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
  });

  return { inView };
}
