import type { ConsoleStreamItem } from "@/lib/console/consoleStream";

export interface ConsoleTone {
  glyph: string;
  name: string;
  glyphClass: string;
  textClass: string;
}

const ERROR = { glyphClass: "text-error", textClass: "text-error" };
const WARNING = { glyphClass: "text-warning", textClass: "text-warning" };
const PLAIN = { glyphClass: "text-foreground", textClass: "text-foreground" };
const MUTED = { glyphClass: "text-[var(--fg-subtle)]", textClass: "text-muted-foreground" };

/** Glyph and colours of a Console row: errors red, warnings amber, info plain, the rest muted. */
export function consoleTone(item: ConsoleStreamItem): ConsoleTone {
  switch (item.kind) {
    case "exception":
      return { glyph: "E", name: "Uncaught exception", ...ERROR };
    case "input":
      return { glyph: "›", name: "You ran", ...MUTED };
    case "result":
      return item.repl.status === "error"
        ? { glyph: "‹", name: "It threw", ...ERROR }
        : { glyph: "‹", name: "It returned", ...PLAIN };
    case "entry": {
      const level = item.entry.level;
      if (level === "error") return { glyph: "E", name: "Error", ...ERROR };
      if (level === "warn") return { glyph: "W", name: "Warning", ...WARNING };
      if (level === "info") return { glyph: "I", name: "Info", ...PLAIN };
      return {
        glyph: level === "debug" ? "D" : "V",
        name: level === "debug" ? "Debug" : "Log",
        ...MUTED,
      };
    }
  }
}

/** The one line a collapsed row shows. */
export function consoleSummary(item: ConsoleStreamItem): string {
  const text =
    item.kind === "entry"
      ? item.entry.message
      : item.kind === "exception"
        ? `Uncaught ${item.exception.message}`
        : item.kind === "input"
          ? item.repl.expression
          : item.repl.result;
  const end = text.indexOf("\n");
  return end < 0 ? text : text.slice(0, end);
}

/** `file.js:12:4` of an item, or null when it has none worth showing. */
export function consoleSource(item: ConsoleStreamItem): string | null {
  if (item.kind === "entry") return item.entry.source === "runtime" ? null : item.entry.source;
  if (item.kind === "exception")
    return item.exception.source === "runtime" ? null : item.exception.source;
  return null;
}

/** The full location (URL with line and column) to copy, or null. */
export function consoleLocation(item: ConsoleStreamItem): string | null {
  const located =
    item.kind === "entry" ? item.entry : item.kind === "exception" ? item.exception : null;
  if (!located?.url) return null;
  const line = located.lineNumber === null ? "" : `:${located.lineNumber}`;
  const column =
    located.lineNumber !== null && located.columnNumber !== null ? `:${located.columnNumber}` : "";
  return `${located.url}${line}${column}`;
}
