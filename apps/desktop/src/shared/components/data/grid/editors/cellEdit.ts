import type { GridColumnType } from "../types";

/**
 * The editor a cell opens with; `null` means the value is not edited inline. `multiline` is a
 * text area for text holding line breaks (or long text): a one-line field drops line breaks.
 */
export type CellEditorKind = "text" | "multiline" | "number" | "boolean" | "date";

/** How a text ends its lines. A text area reads every kind back as a line feed. */
export type LineBreakStyle = "none" | "lf" | "crlf" | "cr" | "mixed";

export type ParsedCellEdit =
  | { ok: true; value: unknown; changed: boolean }
  | { ok: false; error: string };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const ZONE = /(Z|[+-]\d{2}:?\d{2})$/;
const EPOCH_MS_FROM = 1e11;
const LONG_TEXT = 200;
const INTEGER_TEXT = /^[+-]?\d+$/;
const SQLITE_INTEGER_MAX = 9223372036854775807n;
const SQLITE_INTEGER_MIN = -9223372036854775808n;

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

function localDateText(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateInput(text: string): [number, number, number] | null {
  if (!DATE_ONLY.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  return [year, month, day];
}

function epochToMs(value: number): number {
  return Math.abs(value) < EPOCH_MS_FROM ? value * 1000 : value;
}

/** Whether a stored string is a calendar date or a date and time. */
export function isDateText(value: string): boolean {
  return DATE_ONLY.test(value) || DATE_TIME.test(value);
}

function isDateMarker(value: unknown): value is { __type: "Date"; value: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __type?: unknown }).__type === "Date" &&
    typeof (value as { value?: unknown }).value === "string"
  );
}

function isEmpty(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/** Which line breaks a text uses: one kind, none, or a mix the editor cannot give back. */
export function lineBreakStyle(text: string): LineBreakStyle {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const cr = (text.match(/\r/g) ?? []).length - crlf;
  const lf = (text.match(/\n/g) ?? []).length - crlf;
  const kinds = [crlf > 0, cr > 0, lf > 0].filter(Boolean).length;
  if (kinds === 0) return "none";
  if (kinds > 1) return "mixed";
  return crlf > 0 ? "crlf" : cr > 0 ? "cr" : "lf";
}

/**
 * Why a value cannot be edited in a grid cell although its type can, or `null`. A text that
 * mixes two kinds of line break would come back from the editor with one kind only.
 */
export function inlineEditRefusal(value: unknown): string | null {
  if (typeof value === "string" && lineBreakStyle(value) === "mixed") {
    return "This text mixes two kinds of line break; editing it here would make them all one kind, so it is left as it is.";
  }
  return null;
}

function restoreLineBreaks(text: string, style: LineBreakStyle): string {
  if (style === "crlf") return text.replace(/\n/g, "\r\n");
  if (style === "cr") return text.replace(/\n/g, "\r");
  return text;
}

/**
 * The editor for a stored value. Dates are recognised by the value itself (ISO text, a Date),
 * or by the column shown as a date for epoch numbers; never by the field's name. An empty cell
 * edits like `like`, another value of its column, so filling it keeps the column's type.
 */
export function editorKindFor(
  value: unknown,
  showAs?: GridColumnType | null,
  like?: unknown,
): CellEditorKind | null {
  if (isEmpty(value)) {
    if (isEmpty(like)) return "text";
    if (isDateMarker(like)) return "date";
    return editorKindFor(like, showAs);
  }
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number")
    return showAs === "date" && Number.isFinite(value) ? "date" : "number";
  if (typeof value === "string") {
    if (isDateText(value)) return "date";
    return /[\r\n]/.test(value) || value.length > LONG_TEXT ? "multiline" : "text";
  }
  return null;
}

/**
 * The calendar date the person sees for a stored date, in their own time zone. An instant
 * stored in UTC is shown on the local day it falls on, so the picker never starts a day off.
 */
export function toLocalDateInput(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return localDateText(new Date(epochToMs(value)));
  }
  if (typeof value !== "string") return "";
  if (DATE_ONLY.test(value)) return value;
  if (!DATE_TIME.test(value)) return "";
  if (!ZONE.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : localDateText(date);
}

function zoneMinutes(zone: string): number {
  if (zone === "Z") return 0;
  const sign = zone.startsWith("-") ? -1 : 1;
  const digits = zone.slice(1).replace(":", "");
  return sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
}

function formatInZone(instant: Date, original: string, zone: string): string {
  const shifted = new Date(instant.getTime() + zoneMinutes(zone) * 60_000).toISOString();
  const withMillis = /\.\d+(Z|[+-]\d{2}:?\d{2})$/.test(original);
  const seconds = /T\d{2}:\d{2}:\d{2}/.test(original) || / \d{2}:\d{2}:\d{2}/.test(original);
  let body = shifted.slice(0, withMillis ? 23 : seconds ? 19 : 16);
  if (original.charAt(10) === " ") body = `${body.slice(0, 10)} ${body.slice(11)}`;
  return `${body}${zone === "Z" ? "Z" : zone}`;
}

/**
 * Moves a stored date to the calendar day picked in the person's time zone, keeping its time
 * of day, its unit (epoch seconds or milliseconds) and its text format.
 */
export function applyLocalDate(original: unknown, dateInput: string): unknown {
  const picked = parseDateInput(dateInput);
  if (!picked) return original;
  const [year, month, day] = picked;
  if (typeof original === "number") {
    const seconds = Math.abs(original) < EPOCH_MS_FROM;
    const date = new Date(epochToMs(original));
    date.setFullYear(year, month - 1, day);
    return seconds ? date.getTime() / 1000 : date.getTime();
  }
  if (typeof original !== "string" || DATE_ONLY.test(original) || !DATE_TIME.test(original)) {
    return dateInput;
  }
  const zone = ZONE.exec(original)?.[1];
  if (!zone) return `${dateInput}${original.slice(10)}`;
  const date = new Date(original);
  if (Number.isNaN(date.getTime())) return original;
  date.setFullYear(year, month - 1, day);
  return formatInZone(date, original, zone);
}

/** The text an editor starts with. */
export function editorText(value: unknown, kind: CellEditorKind): string {
  if (kind === "date") return toLocalDateInput(value);
  if (value === null || value === undefined) return "";
  if (kind === "multiline" && typeof value === "string") return value.replace(/\r\n?/g, "\n");
  if (typeof value === "object") return JSON.stringify(value) ?? "";
  return String(value as string | number | boolean | bigint);
}

/** A new date in the form `like` stores dates in: a Date, epoch seconds or ms, or ISO text. */
function newDateLike(like: unknown, dateInput: string): unknown {
  const picked = parseDateInput(dateInput);
  if (!picked) return dateInput;
  const [year, month, day] = picked;
  const local = new Date(year, month - 1, day);
  if (isDateMarker(like)) return { __type: "Date", value: local.toISOString() };
  if (typeof like === "number" && Number.isFinite(like)) {
    return Math.abs(like) < EPOCH_MS_FROM ? local.getTime() / 1000 : local.getTime();
  }
  if (typeof like === "string" && DATE_TIME.test(like)) {
    const zone = ZONE.exec(like)?.[1];
    return zone ? formatInZone(local, like, zone) : `${dateInput}${like.charAt(10)}00:00`;
  }
  return dateInput;
}

export interface CellEditOptions {
  /**
   * Integers past 2^53 are kept exact as `{ __type: "Number", value }` (digits in full), up to
   * SQLite's 64-bit range. Without it they are refused, never rounded.
   */
  exactIntegers?: boolean;
}

function wideIntegerText(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const marker = value as { __type?: unknown; value?: unknown };
  return marker.__type === "Number" && typeof marker.value === "string" ? marker.value : null;
}

/**
 * A typed number, never rounded without saying so: an integer JavaScript cannot hold exactly
 * becomes an exact marker (`exactIntegers`) or is refused, and so is any other text `Number()`
 * would turn into such an integer.
 */
function parseNumber(original: unknown, text: string, exactIntegers: boolean): ParsedCellEdit {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, error: "Enter a number" };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, error: `"${trimmed}" is not a number` };
  if (Number.isSafeInteger(value) || !Number.isInteger(value)) {
    return { ok: true, value, changed: !Object.is(value, original) };
  }
  if (!INTEGER_TEXT.test(trimmed)) {
    return { ok: false, error: `"${trimmed}" is too large to keep exactly; type it as digits` };
  }
  const exact = BigInt(trimmed);
  if (!exactIntegers) {
    return {
      ok: false,
      error: `${exact} is too large to keep exactly: whole numbers stop at ${Number.MAX_SAFE_INTEGER} here`,
    };
  }
  if (exact > SQLITE_INTEGER_MAX || exact < SQLITE_INTEGER_MIN) {
    return { ok: false, error: `SQLite whole numbers stop at ${SQLITE_INTEGER_MAX}` };
  }
  const digits = exact.toString();
  return {
    ok: true,
    value: { __type: "Number", value: digits },
    changed: wideIntegerText(original) !== digits,
  };
}

/**
 * Reads what was typed back into a value of the stored type. Text stays text ("123" is not
 * turned into a number), and `changed` is false when nothing would be written. An empty cell
 * left empty is unchanged; one filled in takes the form of `like` (another value of its column).
 */
export function parseCellEdit(
  original: unknown,
  kind: CellEditorKind,
  text: string,
  like?: unknown,
  options: CellEditOptions = {},
): ParsedCellEdit {
  if (isEmpty(original)) {
    if (text.trim() === "") return { ok: true, value: original, changed: false };
    if (kind === "date") {
      if (!parseDateInput(text)) return { ok: false, error: "Pick a date" };
      return { ok: true, value: newDateLike(like, text), changed: true };
    }
  }
  switch (kind) {
    case "text":
      if ((original === null || original === undefined) && text === "") {
        return { ok: true, value: original, changed: false };
      }
      return { ok: true, value: text, changed: text !== original };
    case "multiline": {
      if (isEmpty(original) && text === "") return { ok: true, value: original, changed: false };
      const style = lineBreakStyle(typeof original === "string" ? original : "");
      const value = restoreLineBreaks(text, style === "mixed" ? "lf" : style);
      return { ok: true, value, changed: value !== original };
    }
    case "number":
      return parseNumber(original, text, options.exactIntegers === true);
    case "boolean": {
      if (text !== "true" && text !== "false") return { ok: false, error: "Choose true or false" };
      const value = text === "true";
      return { ok: true, value, changed: value !== original };
    }
    case "date": {
      if (!parseDateInput(text)) return { ok: false, error: "Pick a date" };
      if (text === toLocalDateInput(original)) return { ok: true, value: original, changed: false };
      const value = applyLocalDate(original, text);
      return { ok: true, value, changed: value !== original };
    }
  }
}
