import { argsPreview, hasObjectArgs, type PreviewSegment } from "./consolePreview";
import type { ConsoleStreamItem } from "./consoleStream";

/** A line of a stream row: what the call printed, or a stack frame of an Error it carried. */
export interface InlineLine {
  kind: "message" | "frame";
  segments: PreviewSegment[];
}

/** The lines a stream row shows without being opened, and how many it left for the detail. */
export interface InlineBlock {
  lines: InlineLine[];
  hidden: number;
}

/** Lines a row shows inline before the rest waits for the opened detail. */
export const INLINE_LINE_LIMIT = 20;

const BREAK = /\r?\n/;
const FRAME = /^(\s+)at (?:(.+?) \((.+)\)|(.+))$/;
const blocks = new WeakMap<ConsoleStreamItem, InlineBlock>();

function itemSegments(item: ConsoleStreamItem): PreviewSegment[] {
  switch (item.kind) {
    case "entry":
      return hasObjectArgs(item.entry.args)
        ? argsPreview(item.entry.args, { multiline: true })
        : [{ text: item.entry.message, tone: "text" }];
    case "exception":
      return [{ text: `Uncaught ${item.exception.message}`, tone: "text" }];
    case "input":
      return [{ text: item.repl.expression, tone: "text" }];
    case "result":
      return [{ text: item.repl.result, tone: "text" }];
  }
}

function splitLines(segments: readonly PreviewSegment[]): PreviewSegment[][] {
  const lines: PreviewSegment[][] = [[]];
  for (const segment of segments) {
    segment.text.split(BREAK).forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ ...segment, text: part });
    });
  }
  while (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();
  return lines;
}

/** `https://localhost/assets/index-a1.js:961:32` reads as `index-a1.js:961:32`. */
export function shortLocation(location: string): string {
  return location.replace(/^.*\/(?=[^/]+$)/, "");
}

function frameLine(text: string): InlineLine | null {
  const match = FRAME.exec(text);
  if (!match) return null;
  const [, indent, name, wrapped, bare] = match;
  const location = wrapped ?? bare ?? "";
  const segments: PreviewSegment[] = [{ text: `${indent}at `, tone: "punctuation" }];
  if (name) {
    segments.push({ text: `${name} (`, tone: "type" });
    segments.push({ text: shortLocation(location), tone: "location" });
    segments.push({ text: ")", tone: "type" });
  } else {
    segments.push({ text: shortLocation(location), tone: "location" });
  }
  return { kind: "frame", segments };
}

function toLine(segments: PreviewSegment[]): InlineLine {
  const text = segments.map((segment) => segment.text).join("");
  return frameLine(text) ?? { kind: "message", segments };
}

/**
 * What a row prints inline, the way DevTools prints it: the call's own line breaks kept and an
 * Error's stack laid out as frames. Cached per item, since the list asks for its height too.
 */
export function inlineBlock(item: ConsoleStreamItem): InlineBlock {
  const cached = blocks.get(item);
  if (cached) return cached;
  const lines = splitLines(itemSegments(item));
  const shown = lines.slice(0, INLINE_LINE_LIMIT).map(toLine);
  const block = { lines: shown, hidden: Math.max(0, lines.length - INLINE_LINE_LIMIT) };
  blocks.set(item, block);
  return block;
}
