import type { NetworkEntry } from "@/types/network.types";

/** A finished GET request with sensible defaults, overridable field by field. */
export function networkEntry(overrides: Partial<NetworkEntry> = {}): NetworkEntry {
  const requestId = overrides.requestId ?? "request";
  return {
    requestId,
    url: `https://example.test/${requestId}`,
    method: "GET",
    requestHeaders: {},
    hasPostData: false,
    httpStatus: 200,
    statusText: "OK",
    responseHeaders: {},
    mimeType: "application/json",
    protocol: "h2",
    remoteAddress: "",
    startedAt: 0,
    startTimestamp: 10,
    responseTimestamp: 10.1,
    finishedTimestamp: 10.2,
    timing: null,
    transferSize: 2048,
    state: "finished",
    resourceType: "Fetch",
    fromDiskCache: false,
    fromServiceWorker: false,
    fromPrefetchCache: false,
    initiatorType: "script",
    isWebSocket: false,
    wsFrameCount: 0,
    ...overrides,
  };
}
