import type { CDPClient } from "../client.js";

export interface FetchRequestPattern {
  urlPattern?: string;
  resourceType?: string;
  requestStage?: "Request" | "Response";
}

export interface FetchPausedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  hasPostData?: boolean;
}

export interface FetchHeaderEntry {
  name: string;
  value: string;
}

export interface RequestPausedEvent {
  requestId: string;
  request: FetchPausedRequest;
  frameId: string;
  resourceType: string;
  requestStage: "Request" | "Response";
  responseStatusCode?: number;
  responseStatusText?: string;
  responseHeaders?: FetchHeaderEntry[];
  responseErrorReason?: string;
}

export interface FulfillRequestParams {
  requestId: string;
  responseCode: number;
  responseHeaders?: FetchHeaderEntry[];
  body?: string; // base64-encoded
  responsePhrase?: string;
}

export interface ContinueRequestParams {
  requestId: string;
  url?: string;
  method?: string;
  postData?: string;
  headers?: FetchHeaderEntry[];
  interceptResponse?: boolean;
}

export class FetchDomain {
  constructor(private client: CDPClient) {}

  enable(
    params: { patterns?: FetchRequestPattern[]; handleAuthRequests?: boolean } = {},
  ): Promise<void> {
    return this.client.send("Fetch.enable", params);
  }

  disable(): Promise<void> {
    return this.client.send("Fetch.disable", {});
  }

  continueRequest(params: ContinueRequestParams): Promise<void> {
    return this.client.send("Fetch.continueRequest", params as unknown as Record<string, unknown>);
  }

  fulfillRequest(params: FulfillRequestParams): Promise<void> {
    return this.client.send("Fetch.fulfillRequest", params as unknown as Record<string, unknown>);
  }

  failRequest(params: { requestId: string; errorReason: string }): Promise<void> {
    return this.client.send("Fetch.failRequest", params);
  }

  onRequestPaused(handler: (e: RequestPausedEvent) => void): () => void {
    return this.client.on("Fetch.requestPaused", handler as (e: unknown) => void);
  }
}
