import type { ParsedQuery, QueryTerm } from "./streamQuery.types";

/** A value as it must be typed: quoted when it holds a space or a quote. */
export function formatValue(value: string): string {
  if (value && !/[\s"]/.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** `key:value`, `-key:value` for one field, quoted as needed. */
export function formatTerm(key: string, value: string, negate = false): string {
  return `${negate ? "-" : ""}${key}:${formatValue(value)}`;
}

function tidy(text: string): string {
  return text.replace(/\s{2,}/g, " ").trim();
}

/** The source without the given terms, spaces tidied. */
export function removeTerms(parsed: ParsedQuery, drop: readonly QueryTerm[]): string {
  if (drop.length === 0) return parsed.source;
  const sorted = [...drop].sort((a, b) => b.start - a.start);
  let text = parsed.source;
  for (const term of sorted) text = text.slice(0, term.start) + text.slice(term.end);
  return tidy(text);
}

function sameField(term: QueryTerm, key: string, value: string): boolean {
  return term.key === key && term.operator !== "regex" && term.value === value;
}

/**
 * Adds `key:value` (or its negation) to the query. An identical term is kept as is; the
 * opposite term (`tag:A` when hiding A) is replaced, so a field click never contradicts itself.
 */
export function appendTerm(
  parsed: ParsedQuery,
  key: string,
  value: string,
  negate = false,
): string {
  const same = parsed.terms.find((term) => sameField(term, key, value) && term.negate === negate);
  if (same) return parsed.source;
  const opposite = parsed.terms.filter(
    (term) => sameField(term, key, value) && term.negate !== negate,
  );
  return tidy(`${removeTerms(parsed, opposite)} ${formatTerm(key, value, negate)}`);
}

/**
 * Sets the query's lowest level: every positive `level:` term goes, and `level:<value>` is
 * added unless `value` is null.
 */
export function withLevelFloor(parsed: ParsedQuery, value: string | null): string {
  const levels = parsed.terms.filter((term) => term.key === "level" && !term.negate);
  const rest = removeTerms(parsed, levels);
  return value === null ? rest : tidy(`${rest} level:${value}`);
}
