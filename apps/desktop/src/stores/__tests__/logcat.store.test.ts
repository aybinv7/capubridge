import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import type {
  LogcatLinePayload,
  LogcatStatusPayload,
  LogcatStreamMessage,
} from "@/types/logcat.types";

const runtime = vi.hoisted(() => ({
  channels: [] as Array<(message: LogcatStreamMessage) => void>,
  calls: [] as string[],
  failStart: false,
  buffers: [] as Array<string[] | undefined>,
}));

vi.mock("@/stores/dock.store", () => ({
  useDockStore: () => ({ markUnread: () => undefined }),
}));

vi.mock("@/runtime/session", () => ({
  startLogcatLeaseEffect: (
    serial: string,
    onMessage: (message: LogcatStreamMessage) => void,
    options: { restart?: boolean; buffers?: string[] } = {},
  ) => {
    runtime.channels.push(onMessage);
    runtime.buffers.push(options.buffers);
    return { kind: options.restart ? `restart:${serial}` : `start:${serial}` };
  },
  stopLogcatLeaseEffect: (serial: string) => ({ kind: `stop:${serial}` }),
  runSessionEffect: async (effect: { kind: string }) => {
    runtime.calls.push(effect.kind);
    if (runtime.failStart && effect.kind.startsWith("start:")) {
      throw new Error("device-not-active");
    }
    return {};
  },
}));

import { useLogcatStore } from "../logcat.store";

let seq = 0;

function line(overrides: Partial<LogcatLinePayload> = {}): LogcatLinePayload {
  seq += 1;
  return {
    seq,
    tsMs: 1_730_000_000_000 + seq,
    uid: 10145,
    pid: 100,
    tid: 100,
    level: "I",
    tag: "App",
    message: `line ${seq}`,
    processName: "com.example.shop",
    packageName: "com.example.shop",
    ...overrides,
  };
}

function batch(
  serial: string,
  generation: number,
  lines: LogcatLinePayload[],
): LogcatStreamMessage {
  return { type: "batch", payload: { serial, generation, lines } };
}

function status(
  serial: string,
  generation: number,
  overrides: Partial<LogcatStatusPayload> = {},
): LogcatStreamMessage {
  return {
    type: "status",
    payload: {
      serial,
      generation,
      state: "live",
      attempt: 0,
      message: null,
      retryInMs: null,
      clock: { offsetMs: 2_000, rttMs: 12, measuredAtMs: 1 },
      clockWentBack: false,
      ...overrides,
    },
  };
}

function lastChannel() {
  const channel = runtime.channels.at(-1);
  if (!channel) throw new Error("no channel opened");
  return channel;
}

describe("logcat store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    runtime.channels = [];
    runtime.calls = [];
    runtime.failStart = false;
    runtime.buffers = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("keeps every line, including identical ones, and reports the stream state", async () => {
    const store = useLogcatStore();
    await store.follow("emulator-5554");
    const channel = lastChannel();
    channel(status("emulator-5554", 3));
    const repeated = { message: "same", tsMs: 5 };
    channel(batch("emulator-5554", 3, [line(repeated), line(repeated)]));
    vi.advanceTimersByTime(300);

    expect(store.size).toBe(2);
    expect(store.isStreaming).toBe(true);
    expect(store.clock?.offsetMs).toBe(2_000);
    expect(store.levelCounts.I).toBe(2);
    expect(store.packages).toEqual(["com.example.shop"]);
  });

  test("ignores reports from a replaced run or channel", async () => {
    const store = useLogcatStore();
    await store.follow("emulator-5554");
    const first = lastChannel();
    first(status("emulator-5554", 4));
    await store.restart();
    const second = lastChannel();
    second(status("emulator-5554", 5));

    first(batch("emulator-5554", 4, [line()]));
    second(batch("emulator-5554", 4, [line()]));
    second(status("emulator-5554", 4, { state: "reconnecting", message: "stale" }));
    vi.advanceTimersByTime(300);

    expect(store.size).toBe(0);
    expect(store.streamState).toBe("live");
    expect(runtime.calls).toEqual(["start:emulator-5554", "restart:emulator-5554"]);
  });

  test("says when the stream is reconnecting instead of claiming it is live", async () => {
    const store = useLogcatStore();
    await store.follow("emulator-5554");
    lastChannel()(
      status("emulator-5554", 1, {
        state: "reconnecting",
        attempt: 2,
        message: "adb server restarted",
        retryInMs: 1_000,
      }),
    );
    expect(store.isStreaming).toBe(false);
    expect(store.error).toContain("adb server restarted");
  });

  test("keeps lines while the device is offline and clears on a device switch", async () => {
    const store = useLogcatStore();
    await store.follow("emulator-5554");
    lastChannel()(batch("emulator-5554", 1, [line(), line()]));
    vi.advanceTimersByTime(300);

    await store.follow("emulator-5554", false);
    expect(store.size).toBe(2);
    expect(runtime.calls.at(-1)).toBe("stop:emulator-5554");

    await store.follow("emulator-5554", true);
    expect(runtime.calls.at(-1)).toBe("start:emulator-5554");
    expect(store.size).toBe(2);

    await store.follow("emulator-5556");
    expect(store.size).toBe(0);
    expect(runtime.calls.slice(-2)).toEqual(["stop:emulator-5554", "start:emulator-5556"]);
  });

  test("serialises lease changes so a fast switch cannot interleave", async () => {
    const store = useLogcatStore();
    const first = store.follow("a");
    const second = store.follow("b");
    const third = store.follow(null);
    await Promise.all([first, second, third]);
    expect(runtime.calls).toEqual(["start:a", "stop:a", "start:b", "stop:b"]);
  });

  test("surfaces a failed start", async () => {
    runtime.failStart = true;
    const store = useLogcatStore();
    await store.follow("emulator-5554");
    expect(store.error).toBe("device-not-active");
    expect(store.streamState).toBe("stopped");
  });

  test("pausing keeps capturing and counts the lines it holds back", async () => {
    const store = useLogcatStore();
    await store.follow("emulator-5554");
    store.pause();
    lastChannel()(batch("emulator-5554", 1, [line(), line(), line()]));
    vi.advanceTimersByTime(300);
    expect(store.pausedCount).toBe(3);
    expect(store.pausedDropped).toBe(0);
    expect(store.size).toBe(3);
    store.resume();
    expect(store.pausedCount).toBe(0);
  });
});

describe("logcat buffer choice", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    runtime.channels = [];
    runtime.calls = [];
    runtime.buffers = [];
  });

  test("restarts the capture on the chosen buffers and keeps them across reconnects", async () => {
    const store = useLogcatStore();
    await store.follow("emulator-5554");
    await store.setBuffers(["main", "events"]);
    await store.follow("emulator-5554", false);
    await store.follow("emulator-5554", true);
    await store.setBuffers(null);

    expect(runtime.calls).toEqual([
      "start:emulator-5554",
      "restart:emulator-5554",
      "stop:emulator-5554",
      "start:emulator-5554",
      "restart:emulator-5554",
    ]);
    expect(runtime.buffers).toEqual([
      undefined,
      ["main", "events"],
      ["main", "events"],
      ["default"],
    ]);
  });
});
