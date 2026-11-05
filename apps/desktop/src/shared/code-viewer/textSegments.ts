/** One coloured run of a highlighted line. `color` is a CSS colour, often a `var(--code-…)`. */
export interface CodeToken {
  text: string;
  color?: string;
  italic?: boolean;
}

export interface MarkRange {
  start: number;
  end: number;
  current: boolean;
}

export interface Segment {
  text: string;
  color?: string;
  italic?: boolean;
  mark?: "hit" | "current";
}

/**
 * Cuts a line's coloured runs at find-match boundaries, so a match keeps its syntax colour and
 * gains a mark. Ranges must be sorted and must not overlap; ranges past the line end are clipped.
 */
export function lineSegments(
  line: string,
  tokens: readonly CodeToken[] | undefined,
  ranges: readonly MarkRange[],
): Segment[] {
  const runs: readonly CodeToken[] = tokens && tokens.length > 0 ? tokens : [{ text: line }];
  if (ranges.length === 0) return runs.map((run) => ({ ...run }));

  const segments: Segment[] = [];
  let offset = 0;
  let rangeIndex = 0;
  for (const run of runs) {
    const runEnd = offset + run.text.length;
    let cursor = offset;
    while (cursor < runEnd) {
      while (rangeIndex < ranges.length && (ranges[rangeIndex]?.end ?? 0) <= cursor) {
        rangeIndex += 1;
      }
      const range = ranges[rangeIndex];
      const base = { color: run.color, italic: run.italic };
      if (!range || range.start >= runEnd) {
        segments.push({ ...base, text: run.text.slice(cursor - offset) });
        cursor = runEnd;
      } else if (range.start > cursor) {
        segments.push({ ...base, text: run.text.slice(cursor - offset, range.start - offset) });
        cursor = range.start;
      } else {
        const end = Math.min(range.end, runEnd);
        segments.push({
          ...base,
          text: run.text.slice(cursor - offset, end - offset),
          mark: range.current ? "current" : "hit",
        });
        cursor = end;
      }
    }
    offset = runEnd;
  }
  return segments;
}
