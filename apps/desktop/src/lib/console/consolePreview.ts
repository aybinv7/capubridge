import type { ConsoleArg, ConsoleArgObject, ConsoleArgPrimitive } from "@/types/console.types";

/** What a piece of a value preview is, which decides its colour. */
export type PreviewTone =
  | "key"
  | "index"
  | "string"
  | "number"
  | "literal"
  | "type"
  | "punctuation"
  | "location"
  | "text";

/** A command for every node of one value tree: open or close all, `token` moving each time. */
export interface TreeCommand {
  token: number;
  open: boolean;
}

export interface PreviewSegment {
  text: string;
  tone: PreviewTone;
}

const MAX_STRING = 80;
const MAX_ROW_SEGMENTS = 160;

/** Whether an object description is just its kind, which the preview already shows. */
export function isPlainKind(description: string): boolean {
  return (
    description === "Object" ||
    description === "object" ||
    description === "Array" ||
    /^Array\(\d+\)$/.test(description)
  );
}

export function isArrayLike(arg: ConsoleArgObject): boolean {
  return (
    arg.subtype === "array" || arg.subtype === "typedarray" || arg.description.startsWith("Array(")
  );
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** The tone of a primitive: by its JavaScript type when known, else guessed from its text. */
export function primitiveTone(arg: ConsoleArgPrimitive): PreviewTone {
  switch (arg.valueType) {
    case "string":
      return "string";
    case "number":
    case "bigint":
      return "number";
    case "boolean":
    case "undefined":
    case "null":
    case "symbol":
      return "literal";
    case "function":
      return "type";
    default:
      break;
  }
  if (arg.text === "true" || arg.text === "false" || arg.text === "null") return "literal";
  if (arg.text === "undefined") return "literal";
  if (/^-?\d+(\.\d+)?(e[+-]?\d+)?n?$/i.test(arg.text)) return "number";
  return "string";
}

/** A primitive as it reads inside an object: strings quoted, others as they are. */
export function primitiveText(arg: ConsoleArgPrimitive, quoted: boolean): string {
  if (!quoted || primitiveTone(arg) !== "string") return arg.text;
  return `'${clip(arg.text, MAX_STRING)}'`;
}

/** A nested object reads as its kind only, the way DevTools shows it inside a preview. */
function nestedLabel(arg: ConsoleArgObject): PreviewSegment {
  if (isArrayLike(arg)) return { text: arg.description, tone: "type" };
  if (isPlainKind(arg.description)) return { text: "{…}", tone: "punctuation" };
  return { text: arg.description, tone: "type" };
}

function pushObjectPreview(out: PreviewSegment[], arg: ConsoleArgObject, nested: boolean) {
  if (nested) {
    out.push(nestedLabel(arg));
    return;
  }
  const array = isArrayLike(arg);
  const named = !isPlainKind(arg.description);
  if (named || (array && arg.description !== "Array")) {
    out.push({ text: arg.description, tone: "type" });
    if (arg.properties.length === 0) return;
    out.push({ text: " ", tone: "text" });
  }
  if (arg.properties.length === 0) {
    out.push({ text: array ? "[]" : "{…}", tone: "punctuation" });
    return;
  }
  out.push({ text: array ? "[" : "{", tone: "punctuation" });
  arg.properties.forEach((prop, index) => {
    if (index > 0) out.push({ text: ", ", tone: "punctuation" });
    if (!array) {
      out.push({ text: prop.name, tone: "key" });
      out.push({ text: ": ", tone: "punctuation" });
    }
    pushValue(out, prop.value, true);
  });
  if (arg.overflow) out.push({ text: ", …", tone: "punctuation" });
  out.push({ text: array ? "]" : "}", tone: "punctuation" });
}

function pushValue(out: PreviewSegment[], arg: ConsoleArg, nested: boolean) {
  if (arg.kind === "primitive") {
    out.push({ text: primitiveText(arg, nested), tone: primitiveTone(arg) });
    return;
  }
  pushObjectPreview(out, arg, nested);
}

/** One value as coloured preview pieces, like the collapsed line of a DevTools object. */
export function valuePreview(arg: ConsoleArg, nested = false): PreviewSegment[] {
  const out: PreviewSegment[] = [];
  pushValue(out, arg, nested);
  return out;
}

/** Drops `%c` markers and the style arguments they consume. */
function withoutStyles(args: readonly ConsoleArg[]): readonly ConsoleArg[] {
  const first = args[0];
  if (!first || first.kind !== "primitive" || !first.text.includes("%c")) return args;
  const styles = (first.text.match(/%c/g) ?? []).length;
  let next = 1;
  while (next < args.length && next <= styles && args[next].kind === "primitive") next += 1;
  return [{ ...first, text: first.text.replace(/%c/g, "") }, ...args.slice(next)];
}

const LINE_BREAK = /\r?\n/;

/**
 * A segment that fits one line. A named object's description (an Error with its stack) keeps
 * its first line, which is how DevTools collapses it; any other text shows its breaks as `\n`.
 */
function toOneLine(segment: PreviewSegment): PreviewSegment {
  if (!LINE_BREAK.test(segment.text)) return segment;
  if (segment.tone === "type") return { ...segment, text: segment.text.split(LINE_BREAK, 1)[0] };
  return { ...segment, text: segment.text.replace(/\r?\n/g, "\\n") };
}

/**
 * Preview pieces for a one-line slot: a collapsed row or a tree header. Copy and search keep the
 * full text, so this is applied only where the preview is drawn.
 */
export function oneLinePreview(segments: readonly PreviewSegment[]): PreviewSegment[] {
  return segments.map(toOneLine);
}

/** Fields an Error's description already prints as its message and stack. */
const ERROR_TEXT_FIELDS = new Set(["stack", "message"]);

/**
 * An Error the way DevTools prints it in the stream: its message and stack as text in the row's
 * colour, then its own extra fields (`code`, `data`) on the next line.
 */
function pushErrorBlock(out: PreviewSegment[], arg: ConsoleArgObject) {
  out.push({ text: arg.description, tone: "text" });
  const extra = arg.properties.filter((prop) => !ERROR_TEXT_FIELDS.has(prop.name));
  if (extra.length === 0) return;
  out.push({ text: "\n", tone: "text" });
  pushObjectPreview(out, { ...arg, description: "Object", properties: extra }, false);
}

/** Line breaks are kept only in text the row prints as text; values show them as `\n`. */
function escapeValueBreaks(segment: PreviewSegment): PreviewSegment {
  if (segment.tone === "text" || !LINE_BREAK.test(segment.text)) return segment;
  return { ...segment, text: segment.text.replace(/\r?\n/g, "\\n") };
}

export interface ArgsPreviewOptions {
  /** Keep the breaks of top-level text and Error stacks, for a row that grows to fit them. */
  multiline?: boolean;
}

/**
 * A whole console call: top-level strings as plain text, everything else as its preview,
 * separated by spaces. One line by default; `multiline` keeps the call's own line breaks.
 * Bounded, so a huge object never costs a long row.
 */
export function argsPreview(
  args: readonly ConsoleArg[],
  options: ArgsPreviewOptions = {},
): PreviewSegment[] {
  const multiline = options.multiline === true;
  const out: PreviewSegment[] = [];
  withoutStyles(args).forEach((arg, index) => {
    if (out.length >= MAX_ROW_SEGMENTS) return;
    if (index > 0) out.push({ text: " ", tone: "text" });
    if (arg.kind === "primitive" && primitiveTone(arg) === "string") {
      const end = multiline ? -1 : arg.text.indexOf("\n");
      out.push({ text: end < 0 ? arg.text : arg.text.slice(0, end), tone: "text" });
      return;
    }
    if (multiline && arg.kind === "object" && arg.subtype === "error") {
      pushErrorBlock(out, arg);
      return;
    }
    pushValue(out, arg, false);
  });
  const bounded = out.length > MAX_ROW_SEGMENTS ? out.slice(0, MAX_ROW_SEGMENTS) : out;
  return multiline ? bounded.map(escapeValueBreaks) : oneLinePreview(bounded);
}

function previewValue(arg: ConsoleArg): unknown {
  if (arg.kind === "primitive") {
    const tone = primitiveTone(arg);
    if (tone === "number") {
      const parsed = Number(arg.text);
      return Number.isFinite(parsed) ? parsed : arg.text;
    }
    if (arg.text === "true" || arg.text === "false") return arg.text === "true";
    if (arg.text === "null") return null;
    return arg.text;
  }
  if (arg.properties.length === 0) return isArrayLike(arg) ? [] : arg.description;
  if (isArrayLike(arg)) return arg.properties.map((prop) => previewValue(prop.value));
  return Object.fromEntries(arg.properties.map((prop) => [prop.name, previewValue(prop.value)]));
}

/**
 * JSON of what the message itself carried, for values the page no longer holds. Nested objects
 * the preview did not include come out as their kind ("Object").
 */
export function previewJson(arg: ConsoleArg): string {
  return JSON.stringify(previewValue(arg), null, 2);
}

/** Whether a call has anything a plain message cannot show: an object among its arguments. */
export function hasObjectArgs(args: readonly ConsoleArg[]): boolean {
  return args.some((arg) => arg.kind === "object");
}

/** Tailwind classes per tone, shared by rows and trees so both read the same. */
export const PREVIEW_TONE_CLASS: Readonly<Record<PreviewTone, string>> = {
  key: "text-cat-network",
  index: "text-[var(--fg-subtle)]",
  string: "text-success",
  number: "text-cat-console",
  literal: "text-cat-console",
  type: "text-muted-foreground",
  punctuation: "text-[var(--fg-subtle)]",
  location: "text-cat-network underline decoration-dotted underline-offset-2",
  text: "",
};
