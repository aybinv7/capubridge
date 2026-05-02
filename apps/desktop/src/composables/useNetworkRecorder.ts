import type { CDPClient } from "utils";
import type { useSessionWriter } from "./useSessionWriter";
import type { NetworkCapuTiming } from "@/types/replay.types";

type Writer = ReturnType<typeof useSessionWriter>;

const MAX_BODY_BYTES = 512 * 1024;

interface RequestState {
  url: string;
  method: string;
  resourceType: string;
  startedAtMs: number;
  status: number | null;
  transferSize: number;
  state: "pending" | "finished" | "failed";
  finishedAtMs: number | null;
  mimeType: string | null;
  requestHeaders: Record<string, string> | null;
  responseHeaders: Record<string, string> | null;
  requestBody: string | null;
  timing: NetworkCapuTiming | null;
  initiator: string | null;
  isWebSocket: boolean;
}

export function useNetworkRecorder(client: CDPClient, writer: Writer) {
  const requests = new Map<string, RequestState>();
  const unsubs: Array<() => void> = [];
  const pendingFetches = new Map<string, Promise<void>>();

  function toTiming(t: Record<string, number> | null | undefined): NetworkCapuTiming | null {
    if (!t) return null;
    return {
      dnsStart: t["dnsStart"] ?? -1,
      dnsEnd: t["dnsEnd"] ?? -1,
      connectStart: t["connectStart"] ?? -1,
      connectEnd: t["connectEnd"] ?? -1,
      sslStart: t["sslStart"] ?? -1,
      sslEnd: t["sslEnd"] ?? -1,
      sendStart: t["sendStart"] ?? -1,
      sendEnd: t["sendEnd"] ?? -1,
      receiveHeadersEnd: t["receiveHeadersEnd"] ?? -1,
    };
  }

  function normalizeHeaders(raw: unknown): Record<string, string> | null {
    if (!raw || typeof raw !== "object") return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = String(v);
    }
    return out;
  }

  function emitFinal(requestId: string, responseBody: string | null, responseBodyBase64: boolean) {
    const r = requests.get(requestId);
    if (!r) return;
    writer.pushAt(
      "network",
      {
        requestId,
        url: r.url,
        method: r.method,
        status: r.status,
        resourceType: r.resourceType,
        duration: r.finishedAtMs != null ? r.finishedAtMs - r.startedAtMs : null,
        transferSize: r.transferSize,
        state: r.state,
        mimeType: r.mimeType,
        requestHeaders: r.requestHeaders,
        responseHeaders: r.responseHeaders,
        requestBody: r.requestBody,
        responseBody,
        responseBodyBase64,
        timing: r.timing,
        initiator: r.initiator,
      },
      r.startedAtMs,
    );
  }

  async function fetchAndEmit(requestId: string): Promise<void> {
    const r = requests.get(requestId);
    if (!r || r.isWebSocket) {
      emitFinal(requestId, null, false);
      requests.delete(requestId);
      pendingFetches.delete(requestId);
      return;
    }
    try {
      const res = (await client.send("Network.getResponseBody", { requestId })) as {
        body: string;
        base64Encoded: boolean;
      };
      if (!res.base64Encoded && res.body.length > MAX_BODY_BYTES) {
        emitFinal(requestId, res.body.slice(0, MAX_BODY_BYTES) + "\n[truncated]", false);
      } else if (res.base64Encoded && res.body.length > MAX_BODY_BYTES) {
        emitFinal(requestId, null, false);
      } else {
        emitFinal(requestId, res.body, res.base64Encoded);
      }
    } catch {
      emitFinal(requestId, null, false);
    }
    requests.delete(requestId);
    pendingFetches.delete(requestId);
  }

  async function start() {
    await client.send("Network.enable", { maxPostDataSize: 65536 });

    unsubs.push(
      client.on("Network.requestWillBeSent", (raw: unknown) => {
        const p = raw as {
          requestId: string;
          request: {
            url: string;
            method: string;
            headers: Record<string, string>;
            postData?: string;
          };
          wallTime: number;
          type?: string;
          initiator?: { type: string; url?: string; lineNumber?: number };
        };
        const existing = requests.get(p.requestId);
        if (existing) {
          existing.url = p.request.url;
          existing.method = p.request.method;
          return;
        }
        const initiatorUrl = p.initiator?.url;
        const initiator = initiatorUrl
          ? `${initiatorUrl}${p.initiator?.lineNumber != null ? `:${p.initiator.lineNumber}` : ""}`
          : (p.initiator?.type ?? null);
        requests.set(p.requestId, {
          url: p.request.url,
          method: p.request.method,
          resourceType: p.type ?? "Other",
          startedAtMs: p.wallTime * 1000,
          status: null,
          transferSize: 0,
          state: "pending",
          finishedAtMs: null,
          mimeType: null,
          requestHeaders: normalizeHeaders(p.request.headers),
          responseHeaders: null,
          requestBody: p.request.postData ?? null,
          timing: null,
          initiator,
          isWebSocket: false,
        });
      }),
    );

    unsubs.push(
      client.on("Network.responseReceived", (raw: unknown) => {
        const p = raw as {
          requestId: string;
          response: {
            status: number;
            mimeType: string;
            headers: Record<string, string>;
            timing?: Record<string, number>;
          };
        };
        const r = requests.get(p.requestId);
        if (!r) return;
        r.status = p.response.status;
        r.mimeType = p.response.mimeType ?? null;
        r.responseHeaders = normalizeHeaders(p.response.headers);
        r.timing = toTiming(p.response.timing);
      }),
    );

    unsubs.push(
      client.on("Network.loadingFinished", (raw: unknown) => {
        const p = raw as { requestId: string; encodedDataLength: number };
        const r = requests.get(p.requestId);
        if (!r) return;
        r.transferSize = p.encodedDataLength;
        r.finishedAtMs = Date.now();
        r.state = "finished";
        const fetch = fetchAndEmit(p.requestId);
        pendingFetches.set(p.requestId, fetch);
      }),
    );

    unsubs.push(
      client.on("Network.loadingFailed", (raw: unknown) => {
        const p = raw as { requestId: string; errorText: string };
        const r = requests.get(p.requestId);
        if (!r) return;
        r.finishedAtMs = Date.now();
        r.state = "failed";
        emitFinal(p.requestId, null, false);
        requests.delete(p.requestId);
      }),
    );

    unsubs.push(
      client.on("Network.webSocketCreated", (raw: unknown) => {
        const p = raw as { requestId: string; url: string };
        requests.set(p.requestId, {
          url: p.url,
          method: "WS",
          resourceType: "WebSocket",
          startedAtMs: Date.now(),
          status: null,
          transferSize: 0,
          state: "pending",
          finishedAtMs: null,
          mimeType: null,
          requestHeaders: null,
          responseHeaders: null,
          requestBody: null,
          timing: null,
          initiator: null,
          isWebSocket: true,
        });
      }),
    );

    unsubs.push(
      client.on("Network.webSocketHandshakeResponseReceived", (raw: unknown) => {
        const p = raw as {
          requestId: string;
          response: { status: number; headers: Record<string, string> };
        };
        const r = requests.get(p.requestId);
        if (!r) return;
        r.status = p.response.status;
        r.responseHeaders = normalizeHeaders(p.response.headers);
        r.state = "finished";
        r.finishedAtMs = Date.now();
        emitFinal(p.requestId, null, false);
        requests.delete(p.requestId);
      }),
    );
  }

  async function stop() {
    for (const u of unsubs) u();
    unsubs.length = 0;

    await Promise.allSettled(pendingFetches.values());

    for (const requestId of requests.keys()) {
      emitFinal(requestId, null, false);
    }
    requests.clear();
    pendingFetches.clear();

    try {
      await client.send("Network.disable", {});
    } catch {
      void 0;
    }
  }

  return { start, stop };
}
