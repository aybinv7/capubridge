import { shallowRef } from "vue";
import { readPersisted, writePersisted } from "@/lib/persisted";

const LIMIT = 20;

function isHistory(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Earlier queries of one view, newest first, remembered between runs. */
export function useQueryHistory(storageKey: string) {
  const recent = shallowRef<string[]>(readPersisted<string[]>(storageKey, [], isHistory));

  function remember(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recent.value.filter((item) => item !== trimmed)].slice(0, LIMIT);
    recent.value = next;
    writePersisted(storageKey, next);
  }

  return { recent, remember };
}
