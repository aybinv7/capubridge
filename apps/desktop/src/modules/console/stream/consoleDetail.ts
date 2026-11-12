import { inlineBlock } from "@/lib/console/consoleLines";
import { hasObjectArgs } from "@/lib/console/consolePreview";
import type { ConsoleStreamItem } from "@/lib/console/consoleStream";
import { findJson } from "@/lib/stream-rows/jsonInText";

function hasFrames(item: ConsoleStreamItem): boolean {
  if (item.kind === "entry") return (item.entry.frames?.length ?? 0) > 0;
  if (item.kind === "exception") return (item.exception.frames?.length ?? 0) > 0;
  return false;
}

function plainText(item: ConsoleStreamItem): string {
  if (item.kind === "entry") return item.entry.message;
  if (item.kind === "exception") return item.exception.message;
  if (item.kind === "input") return item.repl.expression;
  return item.repl.result;
}

/**
 * Whether opening a row shows anything its inline lines do not: a value tree, a call stack,
 * JSON laid out, or lines past the inline limit. A plain line opens into nothing, as in DevTools.
 */
export function consoleHasDetail(item: ConsoleStreamItem): boolean {
  if (inlineBlock(item).hidden > 0 || hasFrames(item)) return true;
  if (item.kind === "entry" && hasObjectArgs(item.entry.args)) return true;
  return item.kind !== "input" && findJson(plainText(item)) !== null;
}
