import { shallowRef } from "vue";
import {
  completionContext,
  rankCompletions,
  type CompletionContext,
} from "@/lib/console/replCompletion";
import { useConsoleStore } from "@/stores/console.store";

const CACHE_MS = 5_000;

interface Cached {
  names: string[];
  at: number;
}

/**
 * Completion for the prompt: names on the object before the dot, or globals, read from the
 * target without side effects and cached for a few seconds. A later request supersedes an
 * earlier one, so slow answers never overwrite what is being typed.
 */
export function usePromptCompletion() {
  const store = useConsoleStore();
  const items = shallowRef<string[]>([]);
  const context = shallowRef<CompletionContext | null>(null);
  const error = shallowRef<string | null>(null);
  const cache = new Map<string, Cached>();
  let token = 0;

  async function namesFor(objectExpr: string | null): Promise<string[]> {
    const key = objectExpr ?? "";
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.names;
    const names = await store.completionNames(objectExpr);
    cache.set(key, { names, at: Date.now() });
    return names;
  }

  async function update(text: string, caret: number) {
    const current = ++token;
    const next = completionContext(text, caret);
    if (!next) {
      close();
      return;
    }
    try {
      const names = await namesFor(next.objectExpr);
      if (current !== token) return;
      context.value = next;
      items.value = rankCompletions(names, next.prefix);
      error.value = null;
    } catch (failure) {
      if (current !== token) return;
      items.value = [];
      error.value = failure instanceof Error ? failure.message : String(failure);
    }
  }

  function close() {
    token += 1;
    items.value = [];
    context.value = null;
  }

  return { items, context, error, update, close };
}
