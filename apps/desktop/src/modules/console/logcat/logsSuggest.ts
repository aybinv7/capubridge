import { computed, type Ref } from "vue";
import { LOGCAT_KEY_HELP, LOGCAT_LEVELS, LOGCAT_LEVEL_NAMES } from "@/lib/logcat/logcatQuery";
import type { RingBuffer } from "@/lib/ring-buffer";
import type { QuerySuggestion, SuggestSource } from "@/lib/stream-query/querySuggest";
import type { LogcatEntry } from "@/types/logcat.types";

const TAG_SCAN = 5_000;
const AGES = ["30s", "1m", "5m", "15m", "1h"];

function startsWith(value: string, prefix: string): boolean {
  return value.toLowerCase().startsWith(prefix.toLowerCase());
}

/** The busiest tags among the newest lines, most frequent first. */
function recentTags(ring: RingBuffer<LogcatEntry>): string[] {
  const counts = new Map<string, number>();
  for (const entry of ring.tail(TAG_SCAN)) {
    if (!entry.marker) counts.set(entry.tag, (counts.get(entry.tag) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}

export interface LogsSuggestInput {
  ring: RingBuffer<LogcatEntry>;
  packages: Ref<readonly string[]>;
  myPackage: Ref<string | null>;
  recent: Ref<readonly string[]>;
}

/** Keys, values and earlier queries for the Logs query field's Ctrl+Space list. */
export function useLogsSuggest(input: LogsSuggestInput) {
  function valuesFor(key: string, prefix: string): QuerySuggestion[] {
    switch (key) {
      case "level":
        return LOGCAT_LEVELS.filter(
          (level) => startsWith(level, prefix) || startsWith(LOGCAT_LEVEL_NAMES[level], prefix),
        ).map((level) => ({
          label: level,
          insert: level,
          detail: `${LOGCAT_LEVEL_NAMES[level]} and above`,
        }));
      case "is":
        return [
          { label: "crash", insert: "crash", detail: "Crash lines, Java or native" },
          { label: "stacktrace", insert: "stacktrace", detail: "Lines that hold a stack trace" },
        ].filter((item) => startsWith(item.label, prefix));
      case "age":
        return AGES.filter((age) => startsWith(age, prefix)).map((age) => ({
          label: age,
          insert: age,
          detail: `The last ${age}`,
        }));
      case "package":
      case "process": {
        const mine = input.myPackage.value;
        const items: QuerySuggestion[] = [];
        if (key === "package" && startsWith("mine", prefix)) {
          items.push({ label: "mine", insert: "mine", detail: mine ?? "Choose a WebView first" });
        }
        for (const name of input.packages.value) {
          if (startsWith(name, prefix)) items.push({ label: name, insert: name });
        }
        return items;
      }
      case "tag":
        return recentTags(input.ring)
          .filter((tag) => startsWith(tag, prefix))
          .map((tag) => ({ label: tag, insert: tag }));
      default:
        return [];
    }
  }

  return computed<SuggestSource>(() => ({
    keys: LOGCAT_KEY_HELP,
    valuesFor,
    recent: input.recent.value,
  }));
}
