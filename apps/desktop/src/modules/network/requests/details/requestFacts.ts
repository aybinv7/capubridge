import type { NetworkEntry } from "@/types/network.types";
import {
  entrySizes,
  formatBytes,
  initiatorWord,
  isAppFile,
  statusCell,
  typeWord,
  type CellTone,
} from "../requestCells";
import { requestNameParts } from "../requestNames";
import { findHeader } from "./cookies";

/** One fact of the details pane, said in exactly one place. */
export interface RequestFact {
  key: string;
  value: string;
  tone?: CellTone;
  clamp?: boolean;
}

/** What the details header says: the request's identity, its outcome and its full address. */
export interface HeaderFacts {
  method: string | null;
  name: string;
  status: { text: string; tone: CellTone };
  address: string;
}

/**
 * The header owns method, name, status and address, so the sections below never repeat them.
 * The method is always named here (GET included); a WebSocket has none worth naming.
 */
export function headerFacts(entry: NetworkEntry): HeaderFacts {
  const status = statusCell(entry);
  const code = entry.httpStatus;
  return {
    method: entry.isWebSocket ? null : entry.method.toUpperCase(),
    name: requestNameParts(entry.url).main,
    status: {
      text: code ? `${code} ${entry.statusText}`.trim() : status.text,
      tone: status.tone,
    },
    address: entry.url,
  };
}

/**
 * Size and where it came from, in one value: "1.0 KB transferred · 4.0 KB decoded", "4.0 KB from
 * the disk cache", "12 KB from the app's files". `null` while nothing has arrived, after a failure
 * and for a WebSocket (its frames are their own fact).
 */
export function sizeFact(entry: NetworkEntry): string | null {
  if (entry.isWebSocket || entry.state === "failed" || entry.state === "pending") return null;
  const { transferred, size } = entrySizes(entry);
  const decoded = formatBytes(size);
  if (entry.fromDiskCache) return `${decoded} from the disk cache`;
  if (entry.fromServiceWorker) return `${decoded} from the service worker`;
  if (entry.fromPrefetchCache) return `${decoded} from the prefetch cache`;
  if (isAppFile(entry)) return `${decoded} from the app's files`;
  if (transferred > 0 && size > transferred * 1.05) {
    return `${formatBytes(transferred)} transferred · ${decoded} decoded`;
  }
  return formatBytes(transferred || size);
}

/** Who started the request: the script's full address and line, or a word when no script is known. */
export function initiatorFact(entry: NetworkEntry): string {
  if (!entry.initiatorUrl) return initiatorWord(entry);
  return entry.initiatorLine !== undefined
    ? `${entry.initiatorUrl}:${entry.initiatorLine + 1}`
    : entry.initiatorUrl;
}

/**
 * The General section: only what the header does not say. The media type joins Type only when no
 * `content-type` response header carries it already.
 */
export function generalFacts(entry: NetworkEntry): RequestFact[] {
  const mimeShown = findHeader(entry.responseHeaders, "content-type") !== "";
  const type =
    mimeShown || !entry.mimeType ? typeWord(entry) : `${typeWord(entry)} · ${entry.mimeType}`;
  const facts: RequestFact[] = [
    { key: "Type", value: type },
    { key: "Started by", value: initiatorFact(entry), clamp: true },
  ];
  const size = sizeFact(entry);
  if (size) facts.push({ key: "Size", value: size });
  if (entry.isWebSocket) facts.push({ key: "Frames", value: String(entry.wsFrameCount) });
  if (entry.remoteAddress) facts.push({ key: "Remote address", value: entry.remoteAddress });
  if (entry.protocol) facts.push({ key: "Protocol", value: entry.protocol });
  if (entry.errorText) facts.push({ key: "Error", value: entry.errorText, tone: "error" });
  return facts;
}
