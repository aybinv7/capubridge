import type { CDPClient } from "../client.js";

// ----------- CDP raw shapes -----------

interface CDPNetworkRequest {
  url: string;
  urlFragment?: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  hasPostData?: boolean;
  initialPriority: string;
  referrerPolicy: string;
}

export interface CDPResourceTiming {
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

export interface CDPNetworkResponse {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  mimeType: string;
  charset: string;
  requestHeaders?: Record<string, string>;
  connectionReused: boolean;
  connectionId: number;
  remoteIPAddress?: string;
  remotePort?: number;
  fromDiskCache?: boolean;
  fromServiceWorker?: boolean;
  fromPrefetchCache?: boolean;
  encodedDataLength: number;
  timing?: CDPResourceTiming;
  protocol?: string;
}

interface CDPInitiator {
  type: "parser" | "script" | "preload" | "SignedExchange" | "preflight" | "other";
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}

// ----------- Event payload types -----------

export interface RequestWillBeSentEvent {
  requestId: string;
  loaderId: string;
  documentURL: string;
  request: CDPNetworkRequest;
  timestamp: number;
  wallTime: number;
  initiator: CDPInitiator;
  type?: string;
  redirectResponse?: CDPNetworkResponse;
  frameId?: string;
}

export interface ResponseReceivedEvent {
  requestId: string;
  loaderId: string;
  timestamp: number;
  type: string;
  response: CDPNetworkResponse;
  hasExtraInfo?: boolean;
  frameId?: string;
}

export interface LoadingFinishedEvent {
  requestId: string;
  timestamp: number;
  encodedDataLength: number;
}

export interface LoadingFailedEvent {
  requestId: string;
  timestamp: number;
  type: string;
  errorText: string;
  canceled?: boolean;
  blockedReason?: string;
}

export interface RequestServedFromCacheEvent {
  requestId: string;
}

export interface WebSocketCreatedEvent {
  requestId: string;
  url: string;
  initiator?: CDPInitiator;
  timestamp: number;
}

export interface WebSocketHandshakeEvent {
  requestId: string;
  timestamp: number;
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
  };
}

export interface WebSocketClosedEvent {
  requestId: string;
  timestamp: number;
}

export interface WebSocketFrameEvent {
  requestId: string;
  timestamp: number;
  response: {
    opcode: number;
    mask: boolean;
    payloadData: string;
  };
}

export interface GetResponseBodyResult {
  body: string;
  base64Encoded: boolean;
}

export interface NetworkEnableParams {
  maxTotalBufferSize?: number;
  maxResourceBufferSize?: number;
  maxPostDataSize?: number;
}

// ----------- Domain class -----------

export class NetworkDomain {
  constructor(private client: CDPClient) {}

  enable(params: NetworkEnableParams = {}): Promise<void> {
    return this.client.send("Network.enable", params as Record<string, unknown>) as Promise<void>;
  }

  disable(): Promise<void> {
    return this.client.send("Network.disable") as Promise<void>;
  }

  getResponseBody(requestId: string): Promise<GetResponseBodyResult> {
    return this.client.send<GetResponseBodyResult>("Network.getResponseBody", { requestId });
  }

  async getRequestPostData(requestId: string): Promise<string> {
    const result = await this.client.send<{ postData: string }>("Network.getRequestPostData", {
      requestId,
    });
    return result.postData;
  }

  onRequestWillBeSent(handler: (e: RequestWillBeSentEvent) => void): () => void {
    return this.client.on("Network.requestWillBeSent", handler as (e: unknown) => void);
  }

  onResponseReceived(handler: (e: ResponseReceivedEvent) => void): () => void {
    return this.client.on("Network.responseReceived", handler as (e: unknown) => void);
  }

  onLoadingFinished(handler: (e: LoadingFinishedEvent) => void): () => void {
    return this.client.on("Network.loadingFinished", handler as (e: unknown) => void);
  }

  onLoadingFailed(handler: (e: LoadingFailedEvent) => void): () => void {
    return this.client.on("Network.loadingFailed", handler as (e: unknown) => void);
  }

  onRequestServedFromCache(handler: (e: RequestServedFromCacheEvent) => void): () => void {
    return this.client.on("Network.requestServedFromCache", handler as (e: unknown) => void);
  }

  onWebSocketCreated(handler: (e: WebSocketCreatedEvent) => void): () => void {
    return this.client.on("Network.webSocketCreated", handler as (e: unknown) => void);
  }

  onWebSocketHandshakeResponseReceived(handler: (e: WebSocketHandshakeEvent) => void): () => void {
    return this.client.on(
      "Network.webSocketHandshakeResponseReceived",
      handler as (e: unknown) => void,
    );
  }

  onWebSocketClosed(handler: (e: WebSocketClosedEvent) => void): () => void {
    return this.client.on("Network.webSocketClosed", handler as (e: unknown) => void);
  }

  onWebSocketFrameSent(handler: (e: WebSocketFrameEvent) => void): () => void {
    return this.client.on("Network.webSocketFrameSent", handler as (e: unknown) => void);
  }

  onWebSocketFrameReceived(handler: (e: WebSocketFrameEvent) => void): () => void {
    return this.client.on("Network.webSocketFrameReceived", handler as (e: unknown) => void);
  }
}
