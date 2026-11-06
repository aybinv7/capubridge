import type { ParsedQuery, QueryOperator, QueryTerm } from "./streamQuery.types";

const KEY_PREFIX = /^(-?)([A-Za-z]+)(~:|=:|:)/;

function isSpace(char: string | undefined): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function operatorOf(symbol: string): QueryOperator {
  if (symbol === "~:") return "regex";
  if (symbol === "=:") return "exact";
  return "contains";
}

interface Read {
  value: string;
  end: number;
  quoted: boolean;
}

function readQuoted(source: string, at: number): Read {
  let value = "";
  let index = at + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      value += source[index + 1];
      index += 2;
      continue;
    }
    if (char === '"') return { value, end: index + 1, quoted: true };
    value += char;
    index += 1;
  }
  return { value, end: index, quoted: true };
}

function readBare(source: string, at: number): Read {
  let index = at;
  while (index < source.length && !isSpace(source[index])) index += 1;
  return { value: source.slice(at, index), end: index, quoted: false };
}

function readValue(source: string, at: number): Read {
  return source[at] === '"' ? readQuoted(source, at) : readBare(source, at);
}

/** Reads `/pattern/` from `at` (the opening slash); null when it is not closed. */
function readRegex(source: string, at: number): Read | null {
  let index = at + 1;
  let value = "";
  while (index < source.length) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      const next = source[index + 1];
      value += next === "/" ? "/" : `\\${next}`;
      index += 2;
      continue;
    }
    if (char === "/" && (index + 1 >= source.length || isSpace(source[index + 1]))) {
      return value ? { value, end: index + 1, quoted: false } : null;
    }
    value += char;
    index += 1;
  }
  return null;
}

function readTerm(
  source: string,
  start: number,
  keys: ReadonlySet<string>,
): { term: QueryTerm; quoted: boolean } {
  const rest = source.slice(start);
  const keyed = KEY_PREFIX.exec(rest);
  if (keyed) {
    const key = (keyed[2] ?? "").toLowerCase();
    if (keys.has(key)) {
      const read = readValue(source, start + keyed[0].length);
      return {
        term: {
          key,
          value: read.value,
          negate: keyed[1] === "-",
          operator: operatorOf(keyed[3] ?? ":"),
          start,
          end: read.end,
        },
        quoted: read.quoted,
      };
    }
  }

  const negate = source[start] === "-" && start + 1 < source.length && !isSpace(source[start + 1]);
  const bodyAt = negate ? start + 1 : start;
  if (source[bodyAt] === "/") {
    const regex = readRegex(source, bodyAt);
    if (regex) {
      return {
        term: { key: null, value: regex.value, negate, operator: "regex", start, end: regex.end },
        quoted: true,
      };
    }
  }
  const read = negate ? readValue(source, bodyAt) : readValue(source, start);
  return {
    term: { key: null, value: read.value, negate, operator: "contains", start, end: read.end },
    quoted: read.quoted,
  };
}

/**
 * Splits a query in Android Studio's Logcat grammar into terms: `key:value` (contains),
 * `key=:value` (exact), `key~:pattern` (regex), each negated by a leading `-`; `"quoted
 * values"`; `/regex/` and bare words as free text. Adjacent bare words form one phrase, so
 * `null pointer` searches for that phrase. A `key:` this stream does not know stays free text,
 * so a URL like `http://host` is searched as typed.
 */
export function parseQuery(source: string, keys: readonly string[]): ParsedQuery {
  const known = new Set(keys);
  const terms: QueryTerm[] = [];
  let index = 0;
  let previousPhrase: QueryTerm | null = null;

  while (index < source.length) {
    if (isSpace(source[index])) {
      index += 1;
      continue;
    }
    const { term, quoted } = readTerm(source, index, known);
    index = Math.max(term.end, index + 1);
    if (!term.value && term.key === null) {
      previousPhrase = null;
      continue;
    }

    const isPhraseWord = term.key === null && !term.negate && !quoted;
    if (isPhraseWord && previousPhrase) {
      previousPhrase.value = `${previousPhrase.value} ${term.value}`;
      previousPhrase.end = term.end;
      continue;
    }
    terms.push(term);
    previousPhrase = isPhraseWord ? term : null;
  }

  return { source, terms };
}
