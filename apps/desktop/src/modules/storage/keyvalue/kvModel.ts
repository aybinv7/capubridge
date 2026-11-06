import type {
  KeyValueForagePage,
  KeyValueStorageEntry,
  KeyValueTarget,
} from "@capubridge/cdp-protocol";
import { boundedJson } from "@/shared/components/data/grid/valueFormat";

/** Which kind of key-value storage a source is. */
export type KvSourceKind = "local" | "session" | "forage";

/** One list of keys: an origin's Local or Session storage, or one LocalForage store. */
export interface KvSource {
  /** Stable id: kind, origin and (for LocalForage) database and store. */
  id: string;
  kind: KvSourceKind;
  origin: string;
  database?: string;
  store?: string;
}

/** What a value holds, as the Type column says it. */
export type KvValueType =
  | "object"
  | "array"
  | "number"
  | "boolean"
  | "null"
  | "text"
  | "empty"
  | "special";

/** One key with its value as read from the phone. */
export interface KvEntry {
  /** Built from the key, never from a position. */
  id: string;
  /** The key as text (what the pane edits). */
  key: string;
  /** The key exactly as the phone holds it (LocalForage keys may be encoded). */
  rawKey: unknown;
  /** A text key can be renamed; other LocalForage keys cannot. */
  keyIsText: boolean;
  /**
   * The value as stored, as text: Local and Session storage hold text; a LocalForage value
   * is its encoded JSON. The phone compares it before a write to spot changes made since.
   */
  stored: string;
  /** Local and Session storage: the text; LocalForage: the encoded value (markers for dates…). */
  value: unknown;
  /** What the Value column shows. */
  cell: unknown;
  type: KvValueType;
  typeLabel: string;
  /** Bytes of the stored value (UTF-8). */
  size: number;
  /** Lower-case key and value text, for find. */
  search: string;
  readOnlyReason: string | null;
}

/** Entries read from one source, and whether more exist than were read. */
export interface KvReadResult {
  entries: KvEntry[];
  more: boolean;
  total: number;
}

const PARSE_LIMIT = 256 * 1024;
const SEARCH_LIMIT = 100_000;
const NUMBER = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** The source id of a list: `local::origin`, `session::origin` or `forage::origin::db::store`. */
export function kvSourceId(source: Omit<KvSource, "id">): string {
  if (source.kind === "forage") {
    return `forage::${source.origin}::${source.database ?? ""}::${source.store ?? ""}`;
  }
  return `${source.kind}::${source.origin}`;
}

export function makeSource(source: Omit<KvSource, "id">): KvSource {
  return { ...source, id: kvSourceId(source) };
}

/** Where writes to `source` go on the phone. */
export function targetOf(source: KvSource): KeyValueTarget {
  if (source.kind === "forage") {
    return {
      kind: "forage",
      origin: source.origin,
      database: source.database ?? "",
      store: source.store ?? "",
    };
  }
  return { kind: "area", origin: source.origin, area: source.kind };
}

/** The row id of a key: text keys by their text, other keys by their encoded form. */
export function entryIdFor(rawKey: unknown): string {
  return typeof rawKey === "string" ? `k:${rawKey}` : `j:${JSON.stringify(rawKey)}`;
}

/** UTF-8 byte length of a string, without allocating. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

function searchText(key: string, value: string): string {
  const clipped = value.length > SEARCH_LIMIT ? value.slice(0, SEARCH_LIMIT) : value;
  return `${key}\u0000${clipped}`.toLowerCase();
}

/** What a stored text holds, read the way an app would read it back. */
export function describeText(raw: string): { type: KvValueType; label: string; cell: unknown } {
  if (raw === "") return { type: "empty", label: "Empty", cell: raw };
  const trimmed = raw.trim();
  const first = trimmed[0];
  if ((first === "{" || first === "[") && raw.length <= PARSE_LIMIT) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return { type: "array", label: "JSON list", cell: parsed };
      if (parsed && typeof parsed === "object") {
        return { type: "object", label: "JSON object", cell: parsed };
      }
    } catch {
      return { type: "text", label: "Text", cell: raw };
    }
  }
  if (first === "{" || first === "[") return { type: "text", label: "Long JSON text", cell: raw };
  if (trimmed === "true" || trimmed === "false") {
    return { type: "boolean", label: "Boolean", cell: raw };
  }
  if (trimmed === "null") return { type: "null", label: "null", cell: raw };
  if (NUMBER.test(trimmed)) return { type: "number", label: "Number", cell: raw };
  if (ISO_DATE.test(trimmed)) return { type: "text", label: "Date as text", cell: raw };
  if (first === '"' && trimmed.endsWith('"') && trimmed.length > 1) {
    return { type: "text", label: "Quoted text", cell: raw };
  }
  return { type: "text", label: "Text", cell: raw };
}

/** Local or Session storage entries, as the phone holds them. */
export function areaEntries(entries: readonly KeyValueStorageEntry[]): KvEntry[] {
  return entries.map(({ key, value }) => {
    const described = describeText(value);
    return {
      id: entryIdFor(key),
      key,
      rawKey: key,
      keyIsText: true,
      stored: value,
      value,
      cell: described.cell,
      type: described.type,
      typeLabel: described.label,
      size: utf8Length(value),
      search: searchText(key, value),
      readOnlyReason: null,
    };
  });
}

function markerType(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = (value as { __type?: unknown }).__type;
  return typeof type === "string" ? type : null;
}

/** What a LocalForage value holds, as the Type column says it. */
export function describeValue(value: unknown): { type: KvValueType; label: string } {
  if (value === null) return { type: "null", label: "null" };
  if (typeof value === "string") {
    return value === "" ? { type: "empty", label: "Empty text" } : { type: "text", label: "Text" };
  }
  if (typeof value === "number") return { type: "number", label: "Number" };
  if (typeof value === "boolean") return { type: "boolean", label: "Boolean" };
  if (Array.isArray(value)) return { type: "array", label: "List" };
  const marker = markerType(value);
  if (marker) return { type: "special", label: marker === "TooLarge" ? "Too large" : marker };
  return { type: "object", label: "Object" };
}

function keyText(rawKey: unknown): string {
  if (typeof rawKey === "string") return rawKey;
  const marker = markerType(rawKey);
  if (marker === "Date") {
    const iso = (rawKey as { value?: unknown }).value;
    if (typeof iso === "string") return iso;
  }
  return JSON.stringify(rawKey) ?? "";
}

/** LocalForage entries; values that JSON cannot carry keep their markers and stay read-only. */
export function forageEntries(page: KeyValueForagePage): KvEntry[] {
  return page.entries.map((entry) => {
    const stored = JSON.stringify(entry.value) ?? "null";
    const described = describeValue(entry.value);
    const key = keyText(entry.key);
    const valueText =
      typeof entry.value === "string"
        ? entry.value
        : boundedJson(entry.value, SEARCH_LIMIT, { markers: true });
    return {
      id: entryIdFor(entry.key),
      key,
      rawKey: entry.key,
      keyIsText: typeof entry.key === "string",
      stored,
      value: entry.value,
      cell: entry.value,
      type: described.type,
      typeLabel: described.label,
      size: utf8Length(stored),
      search: searchText(key, valueText),
      readOnlyReason: entry.editable
        ? null
        : (entry.readOnlyReason ?? "This value cannot be saved here."),
    };
  });
}
