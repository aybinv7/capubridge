import { onScopeDispose, shallowRef, watch, type Ref } from "vue";
import type { BodyContent } from "./bodyContent";

/** Bodies above this are formatted after the pane has painted, with a "Formatting…" state. */
export const DEFER_BODY_CHARS = 512 * 1024;
const CACHE_SIZE = 8;

const cache = new Map<string, BodyContent>();

function remember(key: string, content: BodyContent) {
  cache.delete(key);
  cache.set(key, content);
  while (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * The shown form of a body (JSON parsed and pretty-printed, text, picture), kept for the last few
 * requests so stepping back and forth does not parse again. A large body is formatted on the next
 * macrotask, so selecting it paints the pane first and says it is formatting.
 */
export function useBodyContent<T>(
  source: Ref<T | null | undefined>,
  key: Ref<string>,
  size: (value: T) => number,
  build: (value: T) => BodyContent,
) {
  const content = shallowRef<BodyContent | null>(null);
  const formatting = shallowRef(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancel() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  watch(
    [source, key],
    ([value, id]) => {
      cancel();
      formatting.value = false;
      if (value === null || value === undefined) {
        content.value = null;
        return;
      }
      const cached = cache.get(id);
      if (cached) {
        content.value = cached;
        return;
      }
      if (size(value) < DEFER_BODY_CHARS) {
        content.value = build(value);
        remember(id, content.value);
        return;
      }
      content.value = null;
      formatting.value = true;
      timer = setTimeout(() => {
        timer = null;
        content.value = build(value);
        remember(id, content.value);
        formatting.value = false;
      }, 16);
    },
    { immediate: true },
  );

  onScopeDispose(cancel);

  return { content, formatting };
}
