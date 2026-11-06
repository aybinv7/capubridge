import type { CacheStorageEntry, CacheStorageEntryDetail } from "@capubridge/cdp-protocol";
import { mediaType } from "@/shared/http/bodyContent";
import { statusTone, type CellTone } from "@/shared/http/tone";

/** One cached request and its response, as the grid and the pane read it. */
export interface CacheRow {
  id: string;
  url: string;
  method: string;
  /** The response fingerprint as read; a delete is refused when the phone holds another. */
  version: string;
  /** The last part of the address (with its query), or the host for a root address. */
  name: string;
  /** Host, path and query. */
  address: string;
  status: number | null;
  statusLabel: string;
  statusTone: CellTone;
  /** What the body is, in a word: "JSON", "Script", "Image". */
  kind: string;
  mediaType: string | null;
  size: number | null;
  /** The response's `Date` header, in milliseconds. */
  servedAt: number | null;
  /** The headers the list read returned (lower-case names). */
  headers: Readonly<Record<string, string>>;
  /** `basic`, `cors`, `default`, `opaque`… or `null` when the response was not read. */
  responseType: string | null;
  opaque: boolean;
  /** Lower-case text that find looks in. */
  search: string;
}

const KIND_BY_TYPE: [RegExp, string][] = [
  [/json/, "JSON"],
  [/javascript|ecmascript/, "Script"],
  [/^text\/css$/, "Stylesheet"],
  [/^text\/html$/, "Document"],
  [/^image\/svg\+xml$/, "SVG"],
  [/^image\//, "Image"],
  [/^font\/|woff|opentype|truetype/, "Font"],
  [/wasm/, "WebAssembly"],
  [/xml/, "XML"],
  [/^video\//, "Video"],
  [/^audio\//, "Audio"],
  [/^text\//, "Text"],
  [/octet-stream/, "Bytes"],
];

/** A word for what a body of this media type is. */
export function kindOf(type: string | null, opaque: boolean): string {
  if (opaque) return "Opaque";
  if (!type) return "—";
  for (const [pattern, label] of KIND_BY_TYPE) if (pattern.test(type)) return label;
  return type.split("/")[1] ?? type;
}

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The name first (last path segment and query), then the full address without the scheme. */
export function entryName(url: string): { name: string; address: string } {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    const name = `${last ? decoded(last) : parsed.host}${parsed.search}`;
    return { name, address: `${parsed.host}${decoded(parsed.pathname)}${parsed.search}` };
  } catch {
    return { name: url, address: url };
  }
}

function statusOf(entry: CacheStorageEntry): { label: string; tone: CellTone } {
  const response = entry.response;
  if (!response) return { label: "—", tone: "subtle" };
  if (response.type === "opaque" || response.type === "opaqueredirect") {
    return { label: "Opaque", tone: "subtle" };
  }
  return { label: String(response.status), tone: statusTone(response.status) };
}

function httpDate(value: string | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/** The row of one entry, built once per read. */
export function toRow(entry: CacheStorageEntry): CacheRow {
  const response = entry.response;
  const headers = response?.headers ?? {};
  const opaque = response?.type === "opaque" || response?.type === "opaqueredirect";
  const type = headers["content-type"] ? mediaType(headers["content-type"]) : null;
  const { name, address } = entryName(entry.url);
  const status = statusOf(entry);
  const kind = kindOf(type, opaque);
  return {
    id: entry.id,
    url: entry.url,
    method: entry.method,
    version: entry.version,
    name,
    address,
    status: response && !opaque ? response.status : null,
    statusLabel: status.label,
    statusTone: status.tone,
    kind,
    mediaType: type,
    size: response?.size ?? null,
    servedAt: httpDate(headers["date"]),
    headers,
    responseType: response?.type ?? null,
    opaque,
    search:
      `${entry.url}\u0000${entry.method}\u0000${status.label}\u0000${kind}\u0000${type ?? ""}`.toLowerCase(),
  };
}

/** What a response type means for a developer reading it. */
export function responseTypeWords(type: string | null): string {
  switch (type) {
    case "basic":
      return "basic: same origin, every header readable";
    case "cors":
      return "cors: another origin that allowed this page to read it";
    case "opaque":
      return "opaque: a no-cors request; the browser hides its status, headers and body from the page";
    case "opaqueredirect":
      return "opaque redirect: a redirect the page cannot follow or read";
    case "default":
      return "default: built by the app or the service worker";
    case null:
      return "—";
    default:
      return type;
  }
}

/**
 * The phone now holds another response than the list read. A row the list read did not reach
 * has no version to compare, so it never counts as changed.
 */
export function responseChanged(
  row: CacheRow,
  detail: CacheStorageEntryDetail | undefined,
): boolean {
  return detail !== undefined && row.version !== "" && detail.version !== row.version;
}
