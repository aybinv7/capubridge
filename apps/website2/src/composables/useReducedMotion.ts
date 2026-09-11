import { onBeforeUnmount, onMounted, ref } from "vue";

export function useReducedMotion() {
  const reduced = ref(false);
  let query: MediaQueryList | undefined;

  const sync = () => {
    reduced.value = Boolean(query?.matches);
  };

  onMounted(() => {
    query = window.matchMedia("(prefers-reduced-motion: reduce)");
    sync();
    query.addEventListener("change", sync);
  });

  onBeforeUnmount(() => {
    query?.removeEventListener("change", sync);
  });

  return { reduced };
}
