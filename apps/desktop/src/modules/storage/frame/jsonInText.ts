const MAX_PARSED = 1_000_000;

/**
 * Text that holds a JSON object or array, pretty-printed; `null` for anything else. Offline-sync
 * schemas often keep documents in TEXT columns, and they read better parsed.
 */
export function jsonInText(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 2 || value.length > MAX_PARSED) return null;
  const head = value.trimStart()[0];
  if (head !== "{" && head !== "[") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? JSON.stringify(parsed, null, 2) : null;
  } catch {
    return null;
  }
}
