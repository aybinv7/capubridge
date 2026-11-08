export const MAX_RECENT_COMMANDS = 8;
export const MAX_RECENT_APPS = 12;

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/** `id` first, the rest after it without a repeat, kept to `cap` entries. */
export function pushRecent(list: readonly string[], id: string, cap: number): string[] {
  return [id, ...list.filter((entry) => entry !== id)].slice(0, cap);
}
