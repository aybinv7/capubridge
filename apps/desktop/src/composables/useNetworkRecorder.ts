import type { CDPClient } from "utils";
import type { useSessionWriter } from "./useSessionWriter";

type Writer = ReturnType<typeof useSessionWriter>;

interface RequestState {
  url: string;
  method: string;
  resourceType: string;
  startedAtMs: number;
  status: number | null;
  transferSize: number;
  state: string;
  finishedAtMs: number | null;
}

export function useNetworkRecorder(client: CDPClient, writer: Writer) {
  const requests = new Map<string, RequestState>();
  const unsubs: Array<() => void> = [];

  function emit(requestId: string) {
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
        duration: r.finishedAtMs ? r.finishedAtMs - r.startedAtMs : null,
        transferSize: r.transferSize,
        state: r.state,
      },
      r.startedAtMs,
    );
  }

  async function start() {
    await client.send("Network.enable", { maxPostDataSize: 65536 });

    unsubs.push(
      client.on("Network.requestWillBeSent", (raw: unknown) => {
        const p = raw as {
          requestId: string;
          request: { url: string; method: string };
          wallTime: number;
          type?: string;
        };
        requests.set(p.requestId, {
          url: p.request.url,
          method: p.request.method,
          resourceType: p.type ?? "Other",
          startedAtMs: p.wallTime * 1000,
          status: null,
          transferSize: 0,
          state: "pending",
          finishedAtMs: null,
        });
        emit(p.requestId);
      }),
    );

    unsubs.push(
      client.on("Network.responseReceived", (raw: unknown) => {
        const p = raw as { requestId: string; response: { status: number } };
        const r = requests.get(p.requestId);
        if (!r) return;
        r.status = p.response.status;
        emit(p.requestId);
      }),
    );

    unsubs.push(
      client.on("Network.loadingFinished", (raw: unknown) => {
        const p = raw as { requestId: string; encodedDataLength: number; timestamp: number };
        const r = requests.get(p.requestId);
        if (!r) return;
        r.transferSize = p.encodedDataLength;
        r.finishedAtMs = Date.now();
        r.state = "finished";
        emit(p.requestId);
      }),
    );

    unsubs.push(
      client.on("Network.loadingFailed", (raw: unknown) => {
        const p = raw as { requestId: string; errorText: string };
        const r = requests.get(p.requestId);
        if (!r) return;
        r.finishedAtMs = Date.now();
        r.state = `failed: ${p.errorText}`;
        emit(p.requestId);
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
        });
        emit(p.requestId);
      }),
    );
  }

  async function stop() {
    for (const u of unsubs) u();
    unsubs.length = 0;
    try {
      await client.send("Network.disable", {});
    } catch {
      void 0;
    }
    requests.clear();
  }

  return { start, stop };
}
