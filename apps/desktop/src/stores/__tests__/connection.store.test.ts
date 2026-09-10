import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import type { CDPTarget } from "@/types/cdp.types";

vi.mock(
  "@capubridge/cdp-protocol",
  async () => import("../../../../../packages/cdp-protocol/src/index.ts"),
);

const ipc = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@/runtime/ipc/client", () => ({
  invokeCommand: ipc.invoke,
}));

import { useConnectionStore } from "../connection.store";

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.CONNECTING;

  constructor(readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  send() {
    if (this.readyState !== FakeWebSocket.OPEN) throw new Error("Socket is not open");
  }

  close() {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }
}

const target: CDPTarget = {
  id: "target-1",
  type: "page",
  title: "Target",
  url: "https://example.test",
  webSocketDebuggerUrl: "ws://target",
  source: "local",
};

function socket(): FakeWebSocket {
  const current = FakeWebSocket.instances.at(-1);
  if (!current) throw new Error("Missing fake WebSocket");
  return current;
}

describe("connection store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    FakeWebSocket.instances = [];
    ipc.invoke.mockReset();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("rejects close-before-open and permits an explicit reconnect", async () => {
    const store = useConnectionStore();
    const failed = store.connect(target);
    socket().close();
    await expect(failed).rejects.toThrow("closed before opening");
    expect(store.connections.get(target.id)?.status).toBe("error");
    expect(store.getClient(target.id)).toBeUndefined();

    const connected = store.connect(target);
    socket().open();
    await expect(connected).resolves.toBeDefined();
    expect(store.connections.get(target.id)?.status).toBe("connected");
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  test("times out opening, closes the socket and clears pending state", async () => {
    const store = useConnectionStore();
    const pending = store.connect(target);
    const result = expect(pending).rejects.toThrow("Connection timeout");
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(socket().readyState).toBe(FakeWebSocket.CLOSED);
    expect(store.connections.get(target.id)?.status).toBe("error");
    expect(store.getClient(target.id)).toBeUndefined();

    const retry = store.connect(target);
    socket().open();
    await expect(retry).resolves.toBeDefined();
  });

  test("explicit disconnect settles an opening connection", async () => {
    const store = useConnectionStore();
    const pending = store.connect(target);
    const result = expect(pending).rejects.toThrow("closed before opening");
    await store.disconnectTarget(target.id);
    await result;
    expect(store.connections.has(target.id)).toBe(false);
    expect(store.selectedTargetId).toBeNull();
    expect(ipc.invoke).not.toHaveBeenCalled();
  });

  test("stops an ADB proxy after connection setup fails", async () => {
    ipc.invoke.mockResolvedValueOnce({ wsUrl: "ws://proxy", localPort: 9222 });
    ipc.invoke.mockResolvedValueOnce(undefined);
    const store = useConnectionStore();
    const pending = store.connect({ ...target, id: "adb-target", source: "adb" });
    await Promise.resolve();
    await Promise.resolve();
    socket().close();
    await expect(pending).rejects.toThrow("closed before opening");
    expect(ipc.invoke).toHaveBeenNthCalledWith(1, "cdp_start_proxy", {
      wsUrl: "ws://target",
    });
    expect(ipc.invoke).toHaveBeenNthCalledWith(2, "cdp_stop_proxy", {
      wsUrl: "ws://target",
    });
  });
});
