const WORD_BOUNDARY = /[\s\-_./:@>#›·]/;

/**
 * Subsequence match with bonuses for consecutive characters and word starts.
 * Returns 0 when the query is not a subsequence of the text. Higher is better.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const t = text.toLowerCase();

  const direct = t.indexOf(q);
  if (direct !== -1) {
    const atStart = direct === 0 || WORD_BOUNDARY.test(t[direct - 1] ?? "");
    return 1000 + (atStart ? 500 : 0) - direct;
  }

  let score = 0;
  let textIndex = 0;
  let streak = 0;
  let firstFound = -1;
  for (const char of q) {
    if (WORD_BOUNDARY.test(char)) continue;
    const found = t.indexOf(char, textIndex);
    if (found === -1) return 0;
    if (firstFound === -1) firstFound = found;
    if (found - firstFound > q.length * 6) return 0;
    const atWordStart = found === 0 || WORD_BOUNDARY.test(t[found - 1] ?? "");
    streak = found === textIndex ? streak + 1 : 0;
    score += 10 + streak * 5 + (atWordStart ? 15 : 0) - Math.min(found - textIndex, 10);
    textIndex = found + 1;
  }
  return Math.max(score, 1);
}

/** Best score across fields; the first field (the title) counts double. */
export function fieldsScore(query: string, fields: readonly string[]): number {
  let best = 0;
  fields.forEach((field, index) => {
    if (!field) return;
    const score = fuzzyScore(query, field) * (index === 0 ? 2 : 1);
    if (score > best) best = score;
  });
  return best;
}

export function rankByScore<T>(
  items: readonly T[],
  query: string,
  fieldsOf: (item: T) => string | readonly string[],
): T[] {
  if (!query.trim()) return [...items];
  return items
    .map((item, index) => {
      const fields = fieldsOf(item);
      const score =
        typeof fields === "string" ? fuzzyScore(query, fields) : fieldsScore(query, fields);
      return { item, index, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
