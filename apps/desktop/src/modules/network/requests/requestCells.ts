import type { NetworkEntry } from "@/types/network.types";
import { statusTone, type CellTone } from "@/shared/http/tone";
import { isAppAddress } from "./requestNames";

export { TONE_CLASS, statusTone, type CellTone } from "@/shared/http/tone";

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

export interface Cell {
  text: string;
  tone: CellTone;
  title?: string;
}

/** The status column: the HTTP code, or a word for requests that have none. */
export function statusCell(entry: NetworkEntry): Cell {
  if (entry.interrupted) return { text: "Unknown", tone: "subtle", title: entry.errorText };
  if (entry.state === "failed") {
    if (entry.blocked) return { text: "Blocked", tone: "error" };
    return { text: entry.canceled ? "Cancelled" : "Failed", tone: "error" };
  }
  const code = entry.httpStatus;
  if (code === null) return { text: "Pending", tone: "subtle" };
  return { text: String(code), tone: statusTone(code) };
}

/** Whether the app served this file from its own bundle on the phone, not over the network. */
export function isAppFile(entry: NetworkEntry): boolean {
  if (entry.transferSize > 0 || entry.remoteAddress || entry.state !== "finished") return false;
  if (entry.fromDiskCache || entry.fromServiceWorker || entry.fromPrefetchCache) return false;
  try {
    return isAppAddress(new URL(entry.url));
  } catch {
    return false;
  }
}

/** Bytes of a finished request: over the network, and as the decoded body. */
export function entrySizes(entry: NetworkEntry): { transferred: number; size: number } {
  return { transferred: entry.transferSize, size: entry.resourceSize || entry.transferSize };
}

/** The size column: transferred / size like DevTools, where it came from, or frames for a WebSocket. */
export function sizeCell(entry: NetworkEntry): Cell {
  if (entry.isWebSocket) {
    const frames = entry.wsFrameCount;
    return { text: `${frames} ${frames === 1 ? "frame" : "frames"}`, tone: "muted" };
  }
  if (entry.state === "failed") return { text: "—", tone: "subtle" };
  if (entry.fromDiskCache) return { text: "Disk cache", tone: "subtle" };
  if (entry.fromServiceWorker) return { text: "Service worker", tone: "subtle" };
  if (entry.fromPrefetchCache) return { text: "Prefetch", tone: "subtle" };
  if (entry.state === "pending") return { text: "—", tone: "subtle" };
  const { transferred, size } = entrySizes(entry);
  if (isAppFile(entry)) {
    return {
      text: `App · ${formatBytes(size)}`,
      tone: "muted",
      title: `${formatBytes(size)} from the app's own files; nothing crossed the network`,
    };
  }
  const title = `${formatBytes(transferred)} transferred, ${formatBytes(size)} once decoded`;
  if (size > transferred * 1.05 && transferred > 0) {
    return { text: `${formatBytes(transferred)} / ${formatBytes(size)}`, tone: "muted", title };
  }
  return { text: formatBytes(transferred || size), tone: "muted", title };
}

/** Requests slower than these read as slow and very slow. */
export const SLOW_MS = 1000;
export const VERY_SLOW_MS = 3000;

/**
 * The time column: the duration. A failed request keeps how long it ran, quietly, since Status
 * already says how it ended; "—" when that is unknown.
 */
export function timeCell(entry: NetworkEntry): Cell {
  if (entry.interrupted) return { text: "—", tone: "subtle" };
  const ms = durationMs(entry);
  if (entry.state === "failed") {
    return { text: ms === null ? "—" : formatMs(ms), tone: "subtle" };
  }
  if (ms === null) return { text: entry.isWebSocket ? "Open" : "", tone: "subtle" };
  if (ms > VERY_SLOW_MS) return { text: formatMs(ms), tone: "warning" };
  if (ms > SLOW_MS) return { text: formatMs(ms), tone: "default" };
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

/** Who started the request: `file.js:42` (mono) when a script is known, else a word. */
export function initiatorCell(entry: NetworkEntry): { text: string; isFile: boolean } {
  if (entry.initiatorUrl) {
    const file = fileName(entry.initiatorUrl);
    return {
      text: entry.initiatorLine !== undefined ? `${file}:${entry.initiatorLine + 1}` : file,
      isFile: true,
    };
  }
  return { text: INITIATOR_WORDS[entry.initiatorType] ?? entry.initiatorType, isFile: false };
}

/** Who started the request, as text. */
export function initiatorWord(entry: NetworkEntry): string {
  return initiatorCell(entry).text;
}

/** The file a URL names; a site root is its `index.html`, never its host. */
function fileName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").filter(Boolean).pop() ?? "index.html";
  } catch {
    return url.split("/").filter(Boolean).pop() ?? url;
  }
}
