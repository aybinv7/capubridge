import type { LogcatLevel } from "@/types/logcat.types";
import { LOGCAT_LEVEL_NAMES } from "@/lib/logcat/logcatQuery";

export interface LevelTone {
  name: string;
  glyph: string;
  text: string;
}

const ERROR: Omit<LevelTone, "name"> = { glyph: "text-error", text: "text-error" };
const WARNING: Omit<LevelTone, "name"> = { glyph: "text-warning", text: "text-warning" };
const PLAIN: Omit<LevelTone, "name"> = { glyph: "text-foreground", text: "text-foreground" };
const MUTED: Omit<LevelTone, "name"> = {
  glyph: "text-[var(--fg-subtle)]",
  text: "text-muted-foreground",
};

/** Level colours: E and F in the error colour, W warning, I foreground, D and V muted. */
export function logcatLevelTone(level: LogcatLevel): LevelTone {
  const name = LOGCAT_LEVEL_NAMES[level];
  if (level === "E" || level === "F") return { name, ...ERROR };
  if (level === "W") return { name, ...WARNING };
  if (level === "I") return { name, ...PLAIN };
  return { name, ...MUTED };
}
