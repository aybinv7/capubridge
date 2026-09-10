import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import {
  CDPClient,
  CDPCommandTimeoutError,
  CDPConnectionClosedError,
  CDPConnectionError,
} from "../src/index.ts";

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

  fail() {
    this.dispatchEvent(new Event("error"));
  }

  send(data: string) {
    if (this.readyState !== FakeWebSocket.OPEN) throw new Error("Socket is not open");
    this.sent.push(data);
  }

  receive(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  close() {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }
}

function socket(): FakeWebSocket {
  const current = FakeWebSocket.instances.at(-1);
  if (!current) throw new Error("Missing fake WebSocket");
  return current;
}

function sentId(current: FakeWebSocket, index = 0): number {
  const message = JSON.parse(current.sent[index] ?? "{}") as { id?: number };
  if (message.id === undefined) throw new Error("Missing command id");
  return message.id;
}

describe("CDPClient", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("settles successful and protocol-error commands exactly once", async () => {
    const client = new CDPClient("ws://target");
    const current = socket();
    current.open();
    const success = client.send<{ value: number }>("Runtime.evaluate");
    current.receive({ id: sentId(current), result: { value: 7 } });
    current.receive({ id: sentId(current), result: { value: 8 } });
    await expect(success).resolves.toEqual({ value: 7 });

    const failure = client.send("Runtime.callFunctionOn");
    current.receive({ id: sentId(current, 1), error: { message: "Rejected", code: -32_000 } });
    await expect(failure).rejects.toMatchObject({
      name: "CDPProtocolError",
      code: -32_000,
      message: "Rejected",
    });
  });

  test("times out commands and ignores late responses", async () => {
    const client = new CDPClient("ws://target", { commandTimeoutMs: 50 });
    const current = socket();
    current.open();
    const expired = client.send("Runtime.evaluate");
    const expiration = expect(expired).rejects.toBeInstanceOf(CDPCommandTimeoutError);
    const expiredId = sentId(current);
    await vi.advanceTimersByTimeAsync(50);
    await expiration;
    current.receive({ id: expiredId, result: "late" });

    const next = client.send("Runtime.evaluate");
    const nextId = sentId(current, 1);
    expect(nextId).not.toBe(expiredId);
    current.receive({ id: nextId, result: "current" });
    await expect(next).resolves.toBe("current");
  });

  test("rejects all concurrent commands on socket close", async () => {
    const client = new CDPClient("ws://target");
    const current = socket();
    current.open();
    const first = client.send("Network.getResponseBody");
    const second = client.send("Runtime.evaluate");
    current.close();
    await expect(first).rejects.toBeInstanceOf(CDPConnectionClosedError);
    await expect(second).rejects.toBeInstanceOf(CDPConnectionClosedError);
    await vi.advanceTimersByTimeAsync(30_000);
  });

  test("rejects pending commands on socket error", async () => {
    const client = new CDPClient("ws://target");
    const current = socket();
    current.open();
    const pending = client.send("Runtime.evaluate");
    current.fail();
    await expect(pending).rejects.toBeInstanceOf(CDPConnectionError);
  });

  test("waitForOpen handles open, close, error and timeout", async () => {
    const opened = new CDPClient("ws://open");
    const openPromise = opened.waitForOpen(100);
    socket().open();
    await expect(openPromise).resolves.toBeUndefined();

    const closed = new CDPClient("ws://closed");
    const closePromise = closed.waitForOpen(100);
    socket().close();
    await expect(closePromise).rejects.toBeInstanceOf(CDPConnectionClosedError);

    const failed = new CDPClient("ws://failed");
    const errorPromise = failed.waitForOpen(100);
    socket().fail();
    await expect(errorPromise).rejects.toBeInstanceOf(CDPConnectionError);

    const timedOut = new CDPClient("ws://timeout");
    const timeoutPromise = timedOut.waitForOpen(100);
    const timeoutResult = expect(timeoutPromise).rejects.toBeInstanceOf(CDPCommandTimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await timeoutResult;
  });

  test("explicit close rejects commands and repeated close stays safe", async () => {
    const client = new CDPClient("ws://target");
    socket().open();
    const pending = client.send("Runtime.evaluate");
    client.close();
    client.close();
    await expect(pending).rejects.toBeInstanceOf(CDPConnectionClosedError);
    await expect(client.send("Runtime.evaluate")).rejects.toBeInstanceOf(CDPConnectionClosedError);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("cleans event subscriptions and command timers across repeated cycles", async () => {
    const events = vi.fn();
    for (let index = 0; index < 20; index += 1) {
      const client = new CDPClient(`ws://target-${index}`);
      const current = socket();
      current.open();
      client.on("Runtime.consoleAPICalled", events);
      const pending = client.send("Runtime.evaluate");
      const result = expect(pending).rejects.toBeInstanceOf(CDPConnectionClosedError);
      current.close();
      await result;
      current.receive({ method: "Runtime.consoleAPICalled", params: {} });
    }
    expect(events).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
