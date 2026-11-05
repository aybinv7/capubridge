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

/** Lines longer than this render cut, with a marker: one huge DOM run freezes layout. */
export const MAX_RENDERED_LINE = 4_000;

/**
 * The segments to render for a line, cut at `MAX_RENDERED_LINE` characters with a quiet marker
 * saying how much is left out (copy and find still see the whole text).
 */
export function renderedSegments(
  line: string,
  tokens: readonly CodeToken[] | undefined,
  ranges: readonly MarkRange[],
): Segment[] {
  if (line.length <= MAX_RENDERED_LINE) return lineSegments(line, tokens, ranges);
  const kept: CodeToken[] = [];
  let used = 0;
  for (const token of tokens && tokens.length > 0 ? tokens : [{ text: line }]) {
    if (used >= MAX_RENDERED_LINE) break;
    const text = token.text.slice(0, MAX_RENDERED_LINE - used);
    kept.push({ ...token, text });
    used += text.length;
  }
  const visible = ranges.filter((range) => range.start < MAX_RENDERED_LINE);
  const rest = line.length - MAX_RENDERED_LINE;
  return [
    ...lineSegments(line.slice(0, MAX_RENDERED_LINE), kept, visible),
    { text: ` … ${rest.toLocaleString("en-US")} more characters`, color: "var(--fg-subtle)" },
  ];
}
