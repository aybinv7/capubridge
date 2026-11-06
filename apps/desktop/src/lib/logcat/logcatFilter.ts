import type { LogcatEntry, LogcatLevel } from "@/types/logcat.types";

export interface LogcatFilterInput {
  text: string;
  tag: string;
  packageName: string | null;
  levels: readonly LogcatLevel[];
}

const searchTexts = new WeakMap<LogcatEntry, string>();

/** The lowercased text a free-text filter searches, built once per entry on first use. */
export function logcatSearchText(entry: LogcatEntry): string {
  let text = searchTexts.get(entry);
  if (text === undefined) {
    text = [entry.packageName, entry.processName, entry.tag, entry.message]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    searchTexts.set(entry, text);
  }
  return text;
}

const ALL_LEVELS = 6;

/**
 * Compiles the filter once; returns null when it lets everything through, so a view can skip
 * testing entirely.
 */
export function compileLogcatFilter(
  input: LogcatFilterInput,
): ((entry: LogcatEntry) => boolean) | null {
  const text = input.text.trim().toLowerCase();
  const tag = input.tag.trim().toLowerCase();
  const packageName = input.packageName;
  const levels = new Set(input.levels);
  const allLevels = levels.size >= ALL_LEVELS;

  if (!text && !tag && !packageName && allLevels) {
    return null;
  }

  return (entry) => {
    if (!allLevels && !levels.has(entry.level)) {
      return false;
    }
    if (tag && !entry.tag.toLowerCase().includes(tag)) {
      return false;
    }
    if (packageName && entry.packageName !== packageName) {
      return false;
    }
    return !text || logcatSearchText(entry).includes(text);
  };
}
