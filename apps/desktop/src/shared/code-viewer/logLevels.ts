export type LogLevel = "error" | "warn" | "info" | "debug";

const LETTER_LEVELS: Record<string, LogLevel> = {
  F: "error",
  A: "error",
  E: "error",
  W: "warn",
  I: "info",
  D: "debug",
  V: "debug",
};

const THREADTIME = /^\d\d-\d\d\s+\d\d:\d\d:\d\d\.\d+\s+\d+\s+\d+\s+([VDIWEFA])\s/;
const BRIEF = /^([VDIWEFA])\/[^(:\s]+\s*[(:]/;
const WORDS: ReadonlyArray<[RegExp, LogLevel]> = [
  [/\b(?:fatal|error|err|severe|panic|exception)\b/i, "error"],
  [/\b(?:warn|warning)\b/i, "warn"],
  [/\b(?:info|notice)\b/i, "info"],
  [/\b(?:debug|trace|verbose)\b/i, "debug"],
];
const WORD_WINDOW = 160;

/**
 * The level of one log line: logcat's level letter (threadtime and brief formats) when present,
 * otherwise the first level word near the start of the line. Null for lines that state none.
 */
export function logLevel(line: string): LogLevel | null {
  const letter = THREADTIME.exec(line)?.[1] ?? BRIEF.exec(line)?.[1];
  if (letter) return LETTER_LEVELS[letter] ?? null;
  const head = line.slice(0, WORD_WINDOW);
  for (const [pattern, level] of WORDS) {
    if (pattern.test(head)) return level;
  }
  return null;
}
