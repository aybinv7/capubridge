export interface TextMatch {
  line: number;
  start: number;
  end: number;
}

/** The most matches counted; past it the count reads "10,000+" and the rest stay unmarked. */
export const MATCH_LIMIT = 10_000;

/**
 * Case-insensitive, non-overlapping matches of `query` across `lowerLines` (lines already in
 * lower case, computed once per file). Stops at `limit`.
 */
export function findMatches(
  lowerLines: readonly string[],
  query: string,
  limit = MATCH_LIMIT,
): TextMatch[] {
  const needle = query.toLowerCase();
  const matches: TextMatch[] = [];
  if (!needle) return matches;
  for (let line = 0; line < lowerLines.length; line += 1) {
    const text = lowerLines[line] ?? "";
    let from = text.indexOf(needle);
    while (from !== -1) {
      matches.push({ line, start: from, end: from + needle.length });
      if (matches.length >= limit) return matches;
      from = text.indexOf(needle, from + needle.length);
    }
  }
  return matches;
}

/** Match indices grouped by line, so a rendered line finds its own marks in O(1). */
export function matchesByLine(matches: readonly TextMatch[]): Map<number, number[]> {
  const byLine = new Map<number, number[]>();
  matches.forEach((match, index) => {
    const list = byLine.get(match.line);
    if (list) list.push(index);
    else byLine.set(match.line, [index]);
  });
  return byLine;
}

/** The next match index after a step, wrapping at both ends. */
export function stepMatch(current: number, total: number, direction: 1 | -1): number {
  if (total === 0) return -1;
  if (current < 0) return direction === 1 ? 0 : total - 1;
  return (current + direction + total) % total;
}

/** "3 of 41", "No matches", or "10,000+" once the limit is hit. */
export function matchCountLabel(current: number, total: number, limit = MATCH_LIMIT): string {
  if (total === 0) return "No matches";
  const count = total >= limit ? `${limit.toLocaleString("en-US")}+` : String(total);
  return current < 0 ? count : `${current + 1} of ${count}`;
}
