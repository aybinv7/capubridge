import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { CDPClient } from "@capubridge/cdp-protocol";
import { CDPClient as SourceCDPClient } from "../../../../../packages/cdp-protocol/src/index.ts";
import { useNetworkRecorder } from "../useNetworkRecorder";
import type { useSessionWriter } from "../useSessionWriter";

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];

  constructor(readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  send(data: string) {
    if (this.readyState !== FakeWebSocket.OPEN) throw new Error("Socket is not open");
    this.sent.push(data);
  }

  receive(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }
}

function socket(): FakeWebSocket {
  const current = FakeWebSocket.instances.at(-1);
  if (!current) throw new Error("Missing fake WebSocket");
  return current;
}

function sentId(current: FakeWebSocket, index: number): number {
  const message = JSON.parse(current.sent[index] ?? "{}") as { id?: number };
  if (message.id === undefined) throw new Error("Missing command id");
  return message.id;
}

describe("useNetworkRecorder", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("stops after stalled body fetch and records why body is absent", async () => {
    const pushAt = vi.fn();
    const writer = { pushAt } as unknown as ReturnType<typeof useSessionWriter>;
    const client = new SourceCDPClient("ws://target") as unknown as CDPClient;
    const current = socket();
    current.open();
    const recorder = useNetworkRecorder(client, writer);

    const starting = recorder.start();
    current.receive({ id: sentId(current, 0), result: {} });
    await starting;
    current.receive({
      method: "Network.requestWillBeSent",
      params: {
        requestId: "request-1",
        request: { url: "https://example.test/data", method: "GET", headers: {} },
        wallTime: Date.now() / 1000,
        type: "Fetch",
      },
    });
    current.receive({
      method: "Network.loadingFinished",
      params: { requestId: "request-1", encodedDataLength: 12 },
    });
    expect(current.sent).toHaveLength(2);

    const stopping = recorder.stop();
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(current.sent).toHaveLength(3));
    current.receive({ id: sentId(current, 2), result: {} });
    await stopping;

    expect(pushAt).toHaveBeenCalledTimes(1);
    const event = pushAt.mock.calls[0]?.[1] as { responseBodyError?: string };
    expect(event.responseBodyError).toContain("timed out after 2000 ms");
  });
});
