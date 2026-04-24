export type NetworkResourceType =
  | "Document"
  | "Stylesheet"
  | "Image"
  | "Media"
  | "Font"
  | "Script"
  | "TextTrack"
  | "XHR"
  | "Fetch"
  | "EventSource"
  | "WebSocket"
  | "Manifest"
  | "SignedExchange"
  | "Ping"
  | "CSPViolationReport"
  | "Preflight"
  | "Other";

export type NetworkEntryState = "pending" | "finished" | "failed" | "cached";

export type NetworkTypeFilter =
  | "All"
  | "XHR/Fetch"
  | "WS"
  | "Doc"
  | "Img"
  | "Media"
  | "Font"
  | "Script"
  | "Preflight"
  | "Other";

export interface NetworkTiming {
  requestTime: number;
  proxyStart: number;
  proxyEnd: number;
  dnsStart: number;
  dnsEnd: number;
  connectStart: number;
  connectEnd: number;
  sslStart: number;
  sslEnd: number;
  workerStart: number;
  workerEnd: number;
  sendStart: number;
  sendEnd: number;
  receiveHeadersStart: number;
  receiveHeadersEnd: number;
}

export interface NetworkEntry {
  requestId: string;

  // Request
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  hasPostData: boolean;

  // Response
  httpStatus: number | null;
  statusText: string;
  responseHeaders: Record<string, string>;
  mimeType: string;
  protocol: string;
  remoteAddress: string;

  // Timing
  startedAt: number; // wallTime * 1000, Date.now() equivalent
  startTimestamp: number; // CDP monotonic timestamp (seconds)
  responseTimestamp: number | null;
  finishedTimestamp: number | null;
  timing: NetworkTiming | null;

  // Sizes
  transferSize: number; // encoded (network) bytes

  // Lifecycle
  state: NetworkEntryState;
  errorText?: string;
  canceled?: boolean;
  blocked?: boolean;

  // Resource type
  resourceType: NetworkResourceType;

  // Cache
  fromDiskCache: boolean;
  fromServiceWorker: boolean;
  fromPrefetchCache: boolean;

  // Initiator
  initiatorType: string;
  initiatorUrl?: string;
  initiatorLine?: number;

  // WebSocket
  isWebSocket: boolean;
  wsFrameCount: number;
}
