import { fieldsScore } from "../fuzzy";

export interface Scored<T> {
  item: T;
  score: number;
}

/**
 * How well `fields` answer `query`; 0 means no match. Every word of the query has to match some
 * field (the first field, the title, counts double), so "data sqlite" finds "Data › SQLite" even
 * though the words are not next to each other.
 */
export function queryScore(query: string, fields: readonly string[]): number {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  let total = 0;
  for (const word of words) {
    const score = fieldsScore(word, fields);
    if (score === 0) return 0;
    total += score;
  }
  return total;
}

/**
 * Items that match `query`, best first; equal scores keep their order. An empty query keeps every
 * item in its order.
 */
export function scoreItems<T>(
  items: readonly T[],
  query: string,
  fieldsOf: (item: T) => readonly string[],
): Scored<T>[] {
  const scored: Scored<T>[] = [];
  items.forEach((item, index) => {
    const score = queryScore(query, fieldsOf(item));
    if (score > 0) scored.push({ item, score: score - index * 1e-6 });
  });
  return scored.sort((a, b) => b.score - a.score);
}
