/**
 * Small, failure-tolerant persistence for UI layout state. Reads are validated so a
 * corrupted or outdated value falls back instead of breaking the shell.
 */
export function readPersisted<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => boolean,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writePersisted(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to persist ${key}`, error);
  }
}
