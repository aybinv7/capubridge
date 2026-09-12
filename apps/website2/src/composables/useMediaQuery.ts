import { readonly, ref, type Ref } from "vue";

/**
 * Reactive `matchMedia`, shared per query for the lifetime of the page.
 *
 * The cache is deliberate: every consumer of a given query reads the same ref
 * and the same single listener, so mounting twenty components that all ask
 * about the same breakpoint costs one MediaQueryList, not twenty.
 */
const queries = new Map<string, Readonly<Ref<boolean>>>();

export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const existing = queries.get(query);
  if (existing) return existing;

  const matches = ref(false);

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const list = window.matchMedia(query);
    matches.value = list.matches;
    list.addEventListener("change", (event) => {
      matches.value = event.matches;
    });
  }

  const shared = readonly(matches);
  queries.set(query, shared);
  return shared;
}
