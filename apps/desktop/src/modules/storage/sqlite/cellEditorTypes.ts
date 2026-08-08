import type { SqliteColumnInfo } from "@/types/sqlite.types";

/**
 * Picking an inline editor for a SQLite cell.
 *
 * SQLite has no date and no boolean type — both are conventions layered on
 * INTEGER or TEXT. So the declared type alone can't tell us which control to
 * show, and we sniff the stored value as well. Sniffing can be wrong, which is
 * why every column can be overridden explicitly (see `useSqliteColumnEditors`).
 *
 * Whatever the editor shows, the value written back has to keep the shape the
 * column already used — an ISO string stays an ISO string, a unix timestamp
 * stays a number — or the app reading this database won't recognise it.
 */
export type SqliteEditorKind = "text" | "number" | "date" | "boolean" | "json";

export const EDITOR_KINDS: SqliteEditorKind[] = ["text", "number", "date", "boolean", "json"];

/** How a date column stores its value, so we can write back in the same shape. */
export type DateEncoding = "iso" | "date-only" | "epoch-seconds" | "epoch-millis";

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Plausible range for second-based unix timestamps: 1990-01-01 .. 2100-01-01.
const EPOCH_SECONDS_MIN = 631_152_000;
const EPOCH_SECONDS_MAX = 4_102_444_800;

const BOOLEAN_NAME = /^(is|has|can|should|was|are)_|_(flag|enabled|active|deleted|synced|done)$/i;
const DATE_NAME = /(^|_)(date|time|at|on|deadline|expiry|expires|timestamp)$/i;

function declaredType(column: SqliteColumnInfo | undefined): string {
  return (column?.colType ?? "").trim().toUpperCase();
}

function isIntegerLike(type: string): boolean {
  return type.includes("INT");
}

function isRealLike(type: string): boolean {
  return type.includes("REAL") || type.includes("FLOA") || type.includes("DOUB");
}

function isTextLike(type: string): boolean {
  return type.includes("CHAR") || type.includes("TEXT") || type.includes("CLOB");
}

/** Detect how a date value is stored, or null when it isn't a date at all. */
export function detectDateEncoding(value: unknown): DateEncoding | null {
  if (typeof value === "string") {
    if (DATE_ONLY.test(value)) return "date-only";
    if (ISO_DATETIME.test(value)) return "iso";
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= EPOCH_SECONDS_MIN && value <= EPOCH_SECONDS_MAX) return "epoch-seconds";
    if (value >= EPOCH_SECONDS_MIN * 1000 && value <= EPOCH_SECONDS_MAX * 1000) {
      return "epoch-millis";
    }
  }
  return null;
}

function looksLikeJson(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * Choose an editor from the column's declared type and a sample value.
 * `sample` should be a non-null value from the column where possible — a null
 * tells us nothing, so detection falls back to the declared type.
 */
export function detectEditorKind(
  column: SqliteColumnInfo | undefined,
  sample: unknown,
): SqliteEditorKind {
  const type = declaredType(column);
  const name = column?.name ?? "";

  if (type.includes("BLOB")) return "text";
  if (type.includes("BOOL")) return "boolean";
  if (type.includes("DATE") || type.includes("TIME")) return "date";

  if (detectDateEncoding(sample) !== null && (DATE_NAME.test(name) || isTextLike(type))) {
    return "date";
  }

  if (isIntegerLike(type)) {
    // 0/1 in a column named like a flag is the usual boolean encoding.
    const isZeroOne = sample === 0 || sample === 1 || sample === null;
    if (isZeroOne && BOOLEAN_NAME.test(name)) return "boolean";
    if (detectDateEncoding(sample) !== null && DATE_NAME.test(name)) return "date";
    return "number";
  }

  if (isRealLike(type)) return "number";
  if (looksLikeJson(sample)) return "json";
  if (typeof sample === "number") return "number";

  return "text";
}

/** Render a stored value into the string an editor works with. */
export function toEditorString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return `${value}`;
  }
  return JSON.stringify(value) ?? "";
}

/**
 * A date value as `YYYY-MM-DD`, for the calendar control.
 * Returns "" when the value isn't a recognisable date.
 */
export function toDateInputValue(value: unknown): string {
  const encoding = detectDateEncoding(value);
  if (encoding === null) return "";
  if (encoding === "date-only") return String(value);
  if (encoding === "iso") return String(value).slice(0, 10);
  const ms = encoding === "epoch-seconds" ? Number(value) * 1000 : Number(value);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Write a `YYYY-MM-DD` selection back in the encoding the column already used,
 * preserving the original time-of-day for full timestamps so editing the day
 * doesn't silently reset the clock to midnight.
 */
export function fromDateInputValue(dateInput: string, original: unknown): unknown {
  if (!dateInput) return null;
  const encoding = detectDateEncoding(original) ?? "iso";

  if (encoding === "date-only") return dateInput;

  if (encoding === "iso") {
    const previous = new Date(String(original));
    if (Number.isNaN(previous.getTime())) return dateInput;
    const next = new Date(`${dateInput}T00:00:00.000Z`);
    next.setUTCHours(
      previous.getUTCHours(),
      previous.getUTCMinutes(),
      previous.getUTCSeconds(),
      previous.getUTCMilliseconds(),
    );
    // Match the original's precision rather than always emitting millis.
    return String(original).includes(".")
      ? next.toISOString()
      : next.toISOString().replace(/\.\d+Z$/, "Z");
  }

  const previousMs =
    encoding === "epoch-seconds" ? Number(original) * 1000 : Number(original as number);
  const previous = new Date(previousMs);
  const next = new Date(`${dateInput}T00:00:00.000Z`);
  if (!Number.isNaN(previous.getTime())) {
    next.setUTCHours(
      previous.getUTCHours(),
      previous.getUTCMinutes(),
      previous.getUTCSeconds(),
      previous.getUTCMilliseconds(),
    );
  }
  return encoding === "epoch-seconds" ? Math.floor(next.getTime() / 1000) : next.getTime();
}

/** Read a stored value as a boolean, tolerating 0/1, "0"/"1", and "true"/"false". */
export function toBooleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "1" || v === "true" || v === "t" || v === "yes";
  }
  return false;
}

/** Write a boolean back in the same shape the column already used. */
export function fromBooleanValue(next: boolean, original: unknown): unknown {
  if (typeof original === "boolean") return next;
  if (typeof original === "string") {
    const v = original.trim().toLowerCase();
    if (v === "true" || v === "false") return next ? "true" : "false";
    return next ? "1" : "0";
  }
  return next ? 1 : 0;
}

/**
 * Parse the text editors' output back into a storable value.
 * An empty box means NULL — SQLite distinguishes that from an empty string,
 * and blanking a cell almost always means "clear it".
 */
export function parseEditorValue(kind: SqliteEditorKind, raw: string): unknown {
  if (raw === "") return null;

  if (kind === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }

  if (kind === "json") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  if (kind === "text") {
    // Keep text as text: coercing "007" to 7 or "true" to a boolean would
    // corrupt identifiers and codes that merely look numeric.
    return raw;
  }

  return raw;
}

/** Step size for the number stepper: integers move by 1, reals by 0.1. */
export function numberStep(column: SqliteColumnInfo | undefined): number {
  return isRealLike(declaredType(column)) ? 0.1 : 1;
}
