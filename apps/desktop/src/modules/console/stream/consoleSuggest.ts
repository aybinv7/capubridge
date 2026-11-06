import { computed, type Ref } from "vue";
import { CONSOLE_KEY_HELP, CONSOLE_LEVELS, CONSOLE_LEVEL_NAMES } from "@/lib/console/consoleQuery";
import type { ConsoleEntry } from "@/types/console.types";
import type { RingBuffer } from "@/lib/ring-buffer";
import type { QuerySuggestion, SuggestSource } from "@/lib/stream-query/querySuggest";

const URL_SCAN = 2_000;
const AGES = ["30s", "1m", "5m", "15m", "1h"];

function startsWith(value: string, prefix: string): boolean {
  return value.toLowerCase().startsWith(prefix.toLowerCase());
}

function recentUrls(ring: RingBuffer<ConsoleEntry>): string[] {
  const counts = new Map<string, number>();
  for (const entry of ring.tail(URL_SCAN)) {
    if (entry.url) counts.set(entry.url, (counts.get(entry.url) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([url]) => url);
}

/** Keys, values and earlier queries for the Console query field's Ctrl+Space list. */
export function useConsoleSuggest(ring: RingBuffer<ConsoleEntry>, recent: Ref<readonly string[]>) {
  function valuesFor(key: string, prefix: string): QuerySuggestion[] {
    switch (key) {
      case "level":
        return CONSOLE_LEVELS.filter((level) => startsWith(level, prefix)).map((level) => ({
          label: level,
          insert: level,
          detail: `${CONSOLE_LEVEL_NAMES[level]} and above`,
        }));
      case "is":
        return [
          { label: "exception", insert: "exception", detail: "Uncaught exceptions" },
          { label: "network", insert: "network", detail: "Messages about a request" },
          { label: "repl", insert: "repl", detail: "What you ran in the prompt" },
        ].filter((item) => startsWith(item.label, prefix));
      case "age":
        return AGES.filter((age) => startsWith(age, prefix)).map((age) => ({
          label: age,
          insert: age,
          detail: `The last ${age}`,
        }));
      case "url":
        return recentUrls(ring)
          .filter((url) => url.toLowerCase().includes(prefix.toLowerCase()))
          .map((url) => ({ label: url, insert: url }));
      default:
        return [];
    }
  }

  return computed<SuggestSource>(() => ({
    keys: CONSOLE_KEY_HELP,
    valuesFor,
    recent: recent.value,
  }));
}
