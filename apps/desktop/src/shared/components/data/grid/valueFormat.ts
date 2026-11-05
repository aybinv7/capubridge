import type { GridColumnType } from "./types";

export type CellKind = "null" | "boolean" | "number" | "string" | "json" | "date" | "blob";

export interface FormattedCell {
  kind: CellKind;
  /** Single-line display text. */
  text: string;
  /** Short structural hint shown before the text (`{3}`, `[12]`, `⏎2`). */
  badge?: string;
  /** Numbers and dates right-align. */
  align: "start" | "end";
  /** The exact stored form when `text` reads it differently (a date's ISO text in UTC). */
  detail?: string;
}

const BLOB_PREFIX = "[BLOB ";
const MAX_PREVIEW = 240;

function byteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function clip(text: string): string {
  return text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW)}…` : text;
}

const formattedObjects = new WeakMap<object, FormattedCell>();

const LOCAL_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const ZONED_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

/** A date in the person's own time zone, readable (`5 Nov 2026, 14:32`), or `null`. */
export function localDateText(iso: string): string | null {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : LOCAL_DATE.format(time);
}

function dateCell(iso: string): FormattedCell {
  const text = localDateText(iso);
  return text
    ? { kind: "date", text, detail: iso, align: "end" }
    : { kind: "date", text: iso, align: "end" };
}

/**
 * JSON text of a value, stopped once it is longer than `limit` characters, so a preview of a
 * large object never serialises the whole object.
 */
export function boundedJson(
  value: unknown,
  limit: number,
  options: { markers?: boolean } = {},
): string {
  let out = "";
  const seen = new Set<object>();
  function write(node: unknown): boolean {
    if (out.length > limit) return false;
    if (node === null || typeof node !== "object") {
      out += JSON.stringify(node) ?? "null";
      return out.length <= limit;
    }
    if (options.markers && !Array.isArray(node) && isTypedBlob(node) && node.__type !== "Escaped") {
      out += markerText(node);
      return out.length <= limit;
    }
    if (seen.has(node)) {
      out += '"[circular]"';
      return out.length <= limit;
    }
    seen.add(node);
    const list = Array.isArray(node);
    out += list ? "[" : "{";
    let first = true;
    for (const [key, entry] of Object.entries(node)) {
      if (!first) out += ",";
      first = false;
      if (!list) out += `${JSON.stringify(key)}:`;
      if (!write(entry)) return false;
    }
    out += list ? "]" : "}";
    seen.delete(node);
    return out.length <= limit;
  }
  write(value);
  return out;
}

function isTypedBlob(value: object): value is { __type: string } & Record<string, unknown> {
  return "__type" in value && typeof (value as { __type: unknown }).__type === "string";
}

type Marker = { __type: string } & Record<string, unknown>;

function field(marker: Marker, name: string): unknown {
  return marker[name];
}

function plain(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return fallback;
}

/**
 * Text for a value the source cannot carry as JSON (an IndexedDB `__type` marker): what it is
 * and how big, never the raw marker object.
 */
export function describeMarker(marker: Marker): string {
  const type = marker.__type;
  const bytes = field(marker, "size") ?? field(marker, "byteLength");
  switch (type) {
    case "Date":
    case "Number":
      return plain(field(marker, "value"));
    case "BigInt":
      return `${plain(field(marker, "value"))}n`;
    case "Map":
      return `Map of ${plain(field(marker, "size"), "0")}`;
    case "Set":
      return `Set of ${plain(field(marker, "size"), "0")}`;
    case "Undefined":
      return "undefined";
    case "RegExp":
      return `/${plain(field(marker, "source"))}/${plain(field(marker, "flags"), "")}`;
    case "Error":
      return `${plain(field(marker, "name"))}: ${plain(field(marker, "message"))}`;
    case "File":
      return `File ${plain(field(marker, "name"), "")} ${typeof bytes === "number" ? byteSize(bytes) : ""}`.trim();
    case "TooLarge":
      return `Too large to show · ${byteSize(Number(field(marker, "bytes") ?? 0))}`;
    case "Circular":
      return "Refers back to itself";
    case "MaxDepth":
    case "MaxNodes":
      return "Nested too deep to show";
    case "Escaped":
      return "Object with a __type field";
    case "Blob": {
      const size = typeof bytes === "number" ? ` ${byteSize(bytes)}` : "";
      const mime = plain(field(marker, "type"));
      return `Blob${size}${mime ? ` · ${mime}` : ""}`;
    }
    default:
      return typeof bytes === "number" ? `${type} ${byteSize(bytes)}` : type;
  }
}

/** A marker inside a preview: a readable word, with a date in local time. */
function markerText(marker: Marker): string {
  if (marker.__type === "Date") {
    const iso = plain(field(marker, "value"));
    return `Date ${localDateText(iso) ?? iso}`;
  }
  return describeMarker(marker);
}

function formatMarker(marker: Marker): FormattedCell {
  if (marker.__type === "Date") return dateCell(describeMarker(marker));
  if (marker.__type === "Number" || marker.__type === "BigInt") {
    return { kind: "number", text: describeMarker(marker), align: "end" };
  }
  return { kind: "blob", text: describeMarker(marker), align: "start" };
}

/** Epoch numbers: seconds below 10^11 (year 5138), milliseconds above. */
function epochToIso(value: number): string | null {
  const ms = Math.abs(value) < 1e11 ? value * 1000 : value;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Honours a column's display type ("Show values as") when the raw value is stored in
 * another form: epoch numbers as dates, JSON kept in TEXT columns, values forced to text.
 */
function applyDisplayType(value: unknown, type?: GridColumnType): FormattedCell | null {
  if (type === "text") {
    return { kind: "string", text: clip(cellToText(value)), align: "start" };
  }
  if (type === "date") {
    const numeric =
      typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
    if (typeof numeric === "number") {
      const iso = epochToIso(numeric);
      if (iso) return dateCell(iso);
    }
    if (typeof value === "string" && ZONED_DATE_TIME.test(value)) return dateCell(value);
    return null;
  }
  if (type === "json" && typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return typeof parsed === "object" && parsed !== null ? formatCell(parsed) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Display form of any storage value. Pure and allocation-light: it runs for every
 * visible cell on every scroll frame.
 */
export function formatCell(value: unknown, type?: GridColumnType): FormattedCell {
  if (value === null || value === undefined) return { kind: "null", text: "NULL", align: "start" };
  const shown = applyDisplayType(value, type);
  if (shown) return shown;
  if (typeof value === "boolean") return { kind: "boolean", text: String(value), align: "start" };
  if (typeof value === "number" || typeof value === "bigint") {
    if (type === "boolean" && (value === 0 || value === 1)) {
      return { kind: "boolean", text: value === 1 ? "true" : "false", align: "start" };
    }
    return { kind: "number", text: String(value), align: "end" };
  }
  if (value instanceof Date) return dateCell(value.toISOString());
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    return { kind: "blob", text: `blob ${byteSize(value.byteLength)}`, align: "start" };
  }
  if (typeof value === "string") {
    if (value.startsWith(BLOB_PREFIX))
      return { kind: "blob", text: value.slice(1, -1), align: "start" };
    const lines = value.includes("\n") ? value.split("\n").length : 0;
    const flat = lines > 0 ? value.replace(/\s*\n\s*/g, " ⏎ ") : value;
    return {
      kind: "string",
      text: clip(flat),
      badge: lines > 0 ? `⏎${lines - 1}` : undefined,
      align: "start",
    };
  }
  if (typeof value === "object") {
    if (isTypedBlob(value)) return formatMarker(value);
    const cached = formattedObjects.get(value);
    if (cached) return cached;
    const badge = Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}`;
    let text: string;
    try {
      text = clip(boundedJson(value, MAX_PREVIEW, { markers: true }));
    } catch {
      text = "[unserialisable]";
    }
    const formatted: FormattedCell = { kind: "json", text, badge, align: "start" };
    formattedObjects.set(value, formatted);
    return formatted;
  }
  const text = typeof value === "symbol" ? value.toString() : "[function]";
  return { kind: "string", text, align: "start" };
}

/** Plain text for clipboard and filters: full value, no clipping, JSON for structures. */
export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}
