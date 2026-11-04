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

function isTypedBlob(
  value: object,
): value is { __type: string; size?: number; byteLength?: number } {
  return "__type" in value && typeof (value as { __type: unknown }).__type === "string";
}

/**
 * Display form of any storage value. Pure and allocation-light: it runs for every
 * visible cell on every scroll frame.
 */
export function formatCell(value: unknown, type?: GridColumnType): FormattedCell {
  if (value === null || value === undefined) return { kind: "null", text: "NULL", align: "start" };
  if (typeof value === "boolean") return { kind: "boolean", text: String(value), align: "start" };
  if (typeof value === "number" || typeof value === "bigint") {
    if (type === "boolean" && (value === 0 || value === 1)) {
      return { kind: "boolean", text: value === 1 ? "true" : "false", align: "start" };
    }
    return { kind: "number", text: String(value), align: "end" };
  }
  if (value instanceof Date) {
    return { kind: "date", text: value.toISOString(), align: "end" };
  }
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
    if (isTypedBlob(value)) {
      if (value.__type === "Date" && "value" in value) {
        return { kind: "date", text: String((value as { value: unknown }).value), align: "end" };
      }
      const bytes = value.size ?? value.byteLength;
      return {
        kind: "blob",
        text: bytes === undefined ? value.__type : `${value.__type} ${byteSize(bytes)}`,
        align: "start",
      };
    }
    const badge = Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}`;
    let text: string;
    try {
      text = clip(JSON.stringify(value));
    } catch {
      text = "[unserialisable]";
    }
    return { kind: "json", text, badge, align: "start" };
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
