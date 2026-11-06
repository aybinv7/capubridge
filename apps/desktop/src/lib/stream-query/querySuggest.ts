import { formatValue } from "./queryEdit";

/** One line of the suggestion list: what it shows, what it writes, and a plain hint. */
export interface QuerySuggestion {
  label: string;
  insert: string;
  detail?: string;
}

/** A key template the stream offers when nothing after the cursor names a key yet. */
export interface QueryKeyHelp {
  insert: string;
  detail: string;
}

export interface SuggestSource {
  keys: readonly QueryKeyHelp[];
  /** Known values for `key` that start with `prefix` (tags seen, packages, levels, ...). */
  valuesFor(key: string, prefix: string): readonly QuerySuggestion[];
  /** Earlier queries, newest first. */
  recent: readonly string[];
}

/** The text between `from` and `to` is replaced by a picked suggestion's `insert`. */
export interface SuggestResult {
  from: number;
  to: number;
  items: QuerySuggestion[];
}

const LIMIT = 12;
const KEYED = /^(-?)([A-Za-z]+)(~:|=:|:)(.*)$/;
const PARTIAL_KEY = /^-?[A-Za-z]*$/;

function isSpace(char: string | undefined): boolean {
  return char === " " || char === "\t";
}

function tokenBounds(source: string, caret: number): { from: number; to: number } {
  let from = caret;
  while (from > 0 && !isSpace(source[from - 1])) from -= 1;
  let to = caret;
  while (to < source.length && !isSpace(source[to])) to += 1;
  return { from, to };
}

function recentItems(recent: readonly string[], source: string): QuerySuggestion[] {
  const typed = source.trim().toLowerCase();
  return recent
    .filter((query) => query.toLowerCase().startsWith(typed) && query !== source.trim())
    .map((query) => ({ label: query, insert: query, detail: "Earlier query" }));
}

/**
 * Suggestions for the token under the caret (Ctrl+Space): keys while a key is being typed,
 * then values for that key. An empty field offers earlier queries first.
 */
export function suggestQuery(source: string, caret: number, from: SuggestSource): SuggestResult {
  const bounds = tokenBounds(source, caret);
  const token = source.slice(bounds.from, caret);

  if (source.trim() === "") {
    return {
      from: 0,
      to: source.length,
      items: [
        ...recentItems(from.recent, ""),
        ...from.keys.map((help) => ({
          label: help.insert,
          insert: help.insert,
          detail: help.detail,
        })),
      ].slice(0, LIMIT),
    };
  }

  const keyed = KEYED.exec(token);
  if (keyed) {
    const [, negate = "", key = "", operator = ":", typed = ""] = keyed;
    const prefix = typed.replace(/^"/, "");
    const items = from.valuesFor(key.toLowerCase(), prefix).map((item) => ({
      ...item,
      insert: `${negate}${key}${operator}${formatValue(item.insert)} `,
    }));
    return { ...bounds, items: items.slice(0, LIMIT) };
  }

  if (PARTIAL_KEY.test(token)) {
    const lower = token.toLowerCase();
    const items = from.keys
      .filter((help) => help.insert.toLowerCase().startsWith(lower))
      .map((help) => ({ label: help.insert, insert: help.insert, detail: help.detail }));
    const earlier = bounds.from === 0 ? recentItems(from.recent, source) : [];
    return { ...bounds, items: [...items, ...earlier].slice(0, LIMIT) };
  }

  return { ...bounds, items: [] };
}

/** The query with a suggestion applied, and where the caret goes. */
export function applySuggestion(
  source: string,
  result: Pick<SuggestResult, "from" | "to">,
  suggestion: QuerySuggestion,
): { text: string; caret: number } {
  const text = source.slice(0, result.from) + suggestion.insert + source.slice(result.to);
  return { text, caret: result.from + suggestion.insert.length };
}
