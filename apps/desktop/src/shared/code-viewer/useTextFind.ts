import { computed, ref, watch, type Ref } from "vue";
import { refDebounced } from "@vueuse/core";
import { findMatches, matchCountLabel, matchesByLine, stepMatch, type TextMatch } from "./textFind";
import type { MarkRange } from "./textSegments";

const NO_RANGES: readonly MarkRange[] = [];

/**
 * Find in a text view: a debounced query, every match (case-insensitive, capped), the current
 * one, and the marks each rendered line needs. Lower-cased lines are built only once find runs.
 */
export function useTextFind(lines: Ref<readonly string[]>) {
  const open = ref(false);
  const query = ref("");
  const settled = refDebounced(query, 120);
  const current = ref(-1);

  const lowerLines = computed(() => lines.value.map((line) => line.toLowerCase()));
  const matches = computed<TextMatch[]>(() =>
    open.value && settled.value ? findMatches(lowerLines.value, settled.value) : [],
  );
  const byLine = computed(() => matchesByLine(matches.value));
  const label = computed(() => matchCountLabel(current.value, matches.value.length));
  const currentMatch = computed(() => matches.value[current.value] ?? null);

  watch(matches, (list) => {
    current.value = list.length > 0 ? 0 : -1;
  });

  function step(direction: 1 | -1) {
    current.value = stepMatch(current.value, matches.value.length, direction);
  }

  function close() {
    open.value = false;
  }

  /** The marks on one line, sorted, with the current match flagged. */
  function rangesFor(line: number): readonly MarkRange[] {
    const indices = byLine.value.get(line);
    if (!indices) return NO_RANGES;
    return indices.map((index) => {
      const match = matches.value[index];
      return {
        start: match?.start ?? 0,
        end: match?.end ?? 0,
        current: index === current.value,
      };
    });
  }

  return { open, query, matches, current, currentMatch, label, step, close, rangesFor };
}
