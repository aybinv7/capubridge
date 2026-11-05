import type { NetworkEntry, NetworkTypeFilter } from "@/types/network.types";

const OTHER_TYPES = new Set([
  "Other",
  "Stylesheet",
  "TextTrack",
  "Manifest",
  "Ping",
  "EventSource",
  "CSPViolationReport",
  "SignedExchange",
]);

const SINGLE_TYPE: Partial<Record<NetworkTypeFilter, string>> = {
  Doc: "Document",
  Img: "Image",
  Media: "Media",
  Font: "Font",
  Script: "Script",
  Preflight: "Preflight",
};

/** Whether a request is of the chosen type filter. */
export function matchesType(entry: NetworkEntry, type: NetworkTypeFilter): boolean {
  if (type === "All") return true;
  if (type === "WS") return entry.isWebSocket;
  if (type === "XHR/Fetch") {
    return (
      entry.resourceType === "Fetch" ||
      entry.resourceType === "XHR" ||
      entry.initiatorType === "fetch" ||
      entry.initiatorType === "xmlhttprequest"
    );
  }
  if (type === "Other") return OTHER_TYPES.has(entry.resourceType);
  return entry.resourceType === SINGLE_TYPE[type];
}

/** Whether the lower-case query appears in what the address scope searches. */
export function matchesAddress(entry: NetworkEntry, query: string): boolean {
  return (
    entry.url.toLowerCase().includes(query) ||
    entry.method.toLowerCase().includes(query) ||
    String(entry.httpStatus ?? "").includes(query) ||
    entry.mimeType.toLowerCase().includes(query)
  );
}

const headerTextCache = new WeakMap<NetworkEntry, string>();

/** Request and response headers as one lower-case string, cached per entry object. */
export function headerText(entry: NetworkEntry): string {
  let text = headerTextCache.get(entry);
  if (text === undefined) {
    text =
      `${JSON.stringify(entry.requestHeaders)}${JSON.stringify(entry.responseHeaders)}`.toLowerCase();
    headerTextCache.set(entry, text);
  }
  return text;
}
