import type { GridColumnType } from "../types";

/** The editor a cell opens with; `null` means the value is not edited inline. */
export type CellEditorKind = "text" | "number" | "boolean" | "date";

export type ParsedCellEdit =
  | { ok: true; value: unknown; changed: boolean }
  | { ok: false; error: string };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const ZONE = /(Z|[+-]\d{2}:?\d{2})$/;
const EPOCH_MS_FROM = 1e11;

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

/**
 * The editor for a stored value. Dates are recognised by the value itself (ISO text), or by
 * the column shown as a date for epoch numbers; never by the field's name.
 */
export function editorKindFor(
  value: unknown,
  showAs?: GridColumnType | null,
): CellEditorKind | null {
  if (value === null || value === undefined) return "text";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number")
    return showAs === "date" && Number.isFinite(value) ? "date" : "number";
  if (typeof value === "string") return isDateText(value) ? "date" : "text";
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
  if (typeof value === "object") return JSON.stringify(value) ?? "";
  return String(value as string | number | boolean | bigint);
}

/**
 * Reads what was typed back into a value of the stored type. Text stays text ("123" is not
 * turned into a number), and `changed` is false when nothing would be written.
 */
export function parseCellEdit(
  original: unknown,
  kind: CellEditorKind,
  text: string,
): ParsedCellEdit {
  switch (kind) {
    case "text":
      if ((original === null || original === undefined) && text === "") {
        return { ok: true, value: original, changed: false };
      }
      return { ok: true, value: text, changed: text !== original };
    case "number": {
      const trimmed = text.trim();
      if (trimmed === "") return { ok: false, error: "Enter a number" };
      const value = Number(trimmed);
      if (!Number.isFinite(value)) return { ok: false, error: `"${trimmed}" is not a number` };
      return { ok: true, value, changed: !Object.is(value, original) };
    }
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
