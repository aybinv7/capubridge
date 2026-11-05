import type { NetworkEntry } from "@/types/network.types";

const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;

/** A byte count for people: "0 B", then one decimal below 10 of a unit. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
}

/** A duration in milliseconds as people read it: "<1 ms", "240 ms", "1.24 s". */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1) return "<1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** How long a request took, or null while it has not finished. */
export function durationMs(entry: NetworkEntry): number | null {
  if (entry.finishedTimestamp === null) return null;
  return Math.max(0, (entry.finishedTimestamp - entry.startTimestamp) * 1000);
}

export type CellTone = "default" | "muted" | "subtle" | "warning" | "error";

export interface Cell {
  text: string;
  tone: CellTone;
}

/** The status column: the HTTP code, or a word for requests that have none. */
export function statusCell(entry: NetworkEntry): Cell {
  if (entry.state === "failed") {
    if (entry.blocked) return { text: "Blocked", tone: "error" };
    return { text: entry.canceled ? "Cancelled" : "Failed", tone: "error" };
  }
  const code = entry.httpStatus;
  if (code === null) return { text: "Pending", tone: "subtle" };
  return { text: String(code), tone: statusTone(code) };
}

/** The tone of an HTTP code: client errors warn, server errors fail, redirects are quiet. */
export function statusTone(code: number): CellTone {
  if (code >= 500) return "error";
  if (code >= 400) return "warning";
  if (code >= 300) return "muted";
  return "default";
}

/** The size column: bytes on the wire, where it came from, or frames for a WebSocket. */
export function sizeCell(entry: NetworkEntry): Cell {
  if (entry.isWebSocket) {
    const frames = entry.wsFrameCount;
    return { text: `${frames} ${frames === 1 ? "frame" : "frames"}`, tone: "muted" };
  }
  if (entry.state === "failed") return { text: "—", tone: "subtle" };
  if (entry.fromDiskCache) return { text: "Disk cache", tone: "subtle" };
  if (entry.fromServiceWorker) return { text: "Service worker", tone: "subtle" };
  if (entry.fromPrefetchCache) return { text: "Prefetch", tone: "subtle" };
  if (entry.state === "pending") return { text: "…", tone: "subtle" };
  return { text: formatBytes(entry.transferSize), tone: "muted" };
}

/** Requests slower than these read as slow and very slow. */
export const SLOW_MS = 1000;
export const VERY_SLOW_MS = 3000;

/** The time column: the duration, or what stopped the request. */
export function timeCell(entry: NetworkEntry): Cell {
  if (entry.state === "failed")
    return { text: entry.canceled ? "Cancelled" : "Failed", tone: "error" };
  const ms = durationMs(entry);
  if (ms === null) return { text: entry.isWebSocket ? "Open" : "Pending", tone: "subtle" };
  if (ms > VERY_SLOW_MS) return { text: formatMs(ms), tone: "error" };
  if (ms > SLOW_MS) return { text: formatMs(ms), tone: "warning" };
  return { text: formatMs(ms), tone: "muted" };
}

const TYPE_WORDS: Record<string, string> = {
  Document: "Document",
  Stylesheet: "Style",
  Image: "Image",
  Media: "Media",
  Font: "Font",
  Script: "Script",
  TextTrack: "Text track",
  XHR: "XHR",
  Fetch: "Fetch",
  EventSource: "Events",
  WebSocket: "WebSocket",
  Manifest: "Manifest",
  SignedExchange: "Exchange",
  Ping: "Ping",
  CSPViolationReport: "CSP report",
  Preflight: "Preflight",
  Other: "Other",
};

/** The resource type as a short word. */
export function typeWord(entry: NetworkEntry): string {
  if (entry.isWebSocket) return "WebSocket";
  return TYPE_WORDS[entry.resourceType] ?? entry.resourceType;
}

const INITIATOR_WORDS: Record<string, string> = {
  parser: "Page",
  script: "Script",
  preload: "Preload",
  preflight: "Preflight",
  SignedExchange: "Exchange",
  other: "Other",
};

/** Who started the request: `file.js:42` when a script is known, else a word. */
export function initiatorWord(entry: NetworkEntry): string {
  if (entry.initiatorUrl) {
    const file = lastSegment(entry.initiatorUrl) || entry.initiatorUrl;
    return entry.initiatorLine !== undefined ? `${file}:${entry.initiatorLine + 1}` : file;
  }
  return INITIATOR_WORDS[entry.initiatorType] ?? entry.initiatorType;
}

function lastSegment(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").filter(Boolean).pop() ?? parsed.host;
  } catch {
    return url.split("/").filter(Boolean).pop() ?? url;
  }
}

/** What a row is called: the path and query, the media type for `data:` URLs. */
export function requestName(url: string): string {
  if (url.startsWith("data:")) {
    const end = url.search(/[;,]/);
    return end > 0 ? url.slice(0, end) : "data:";
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "blob:") return url;
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return url;
  }
}

/** The host a request went to, or an empty string when the URL has none. */
export function requestHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** Tailwind text classes for a cell tone. */
export const TONE_CLASS: Record<CellTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  subtle: "text-[var(--fg-subtle)]",
  warning: "text-warning",
  error: "text-error",
};
