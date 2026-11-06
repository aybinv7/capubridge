const SAFE_DIGITS = /^-?\d{1,15}$/;
const WIDE_DIGITS = /^-?\d{16,19}$/;
const DECIMAL = /^-?(?:\d+\.\d*|\.\d+|\d+)(?:e[+-]?\d+)?$/i;

/**
 * A key value as typed: digits become a number (wide integers stay exact, as the grid reads
 * them), `NULL` is NULL, quotes keep text as text, anything else is text.
 */
export function keyValueOf(text: string): unknown {
  const value = text.trim();
  if (/^null$/i.test(value)) return null;
  const quoted = /^(['"])(.*)\1$/.exec(value);
  if (quoted) return quoted[2] ?? "";
  if (SAFE_DIGITS.test(value)) return Number(value);
  if (WIDE_DIGITS.test(value)) {
    const exact = BigInt(value);
    return exact >= BigInt(Number.MIN_SAFE_INTEGER) && exact <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : { __type: "Number", value: exact.toString() };
  }
  if (DECIMAL.test(value)) return Number(value);
  return value;
}

/** What "go to row" was asked for: a row number (`#40`), or the key's values in key order. */
export type RowTarget = { kind: "number"; row: number } | { kind: "key"; values: unknown[] };

/** Reads `#40`, `4182`, or `12, 3` for a composite key; `null` when it cannot be a target. */
export function parseRowTarget(text: string, keyColumns: number): RowTarget | null {
  const value = text.trim();
  if (!value) return null;
  const numbered = /^#\s*(\d+)$/.exec(value);
  if (numbered) {
    const row = Number(numbered[1]);
    return row >= 1 ? { kind: "number", row } : null;
  }
  if (keyColumns === 0) return null;
  const parts = keyColumns === 1 ? [value] : value.split(",");
  if (parts.length !== keyColumns || parts.some((part) => part.trim() === "")) return null;
  return { kind: "key", values: parts.map(keyValueOf) };
}
