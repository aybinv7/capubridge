import { shallowRef } from "vue";
import { readPersisted, writePersisted } from "@/lib/persisted";

const KEY = "capubridge:drawer-prompt-history";
const LIMIT = 100;

function isHistory(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * What was run in the prompt, oldest first, remembered between runs and targets. ↑ walks back
 * from the draft, ↓ walks forward and ends on the draft as it was left.
 */
export function usePromptHistory() {
  const entries = shallowRef<string[]>(readPersisted<string[]>(KEY, [], isHistory));
  let index = -1;
  let draft = "";

  function remember(expression: string) {
    const trimmed = expression.trim();
    index = -1;
    draft = "";
    if (!trimmed) return;
    const next = [...entries.value.filter((item) => item !== trimmed), trimmed].slice(-LIMIT);
    entries.value = next;
    writePersisted(KEY, next);
  }

  /** The text to show after stepping `direction` (−1 older, +1 newer), or null when there is none. */
  function step(direction: -1 | 1, current: string): string | null {
    const list = entries.value;
    if (list.length === 0) return null;
    if (index === -1) {
      if (direction === 1) return null;
      draft = current;
      index = list.length - 1;
      return list[index] ?? null;
    }
    const next = index + direction;
    if (next < 0) return null;
    if (next >= list.length) {
      index = -1;
      return draft;
    }
    index = next;
    return list[index] ?? null;
  }

  function reset() {
    index = -1;
  }

  return { entries, remember, step, reset };
}
