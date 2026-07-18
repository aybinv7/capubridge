import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { createMirrorLifecycle } from "../mirrorLifecycle";

afterEach(() => {
  vi.useRealTimers();
});

describe("mirror lifecycle", () => {
  test("invalidates previous run and session tokens", () => {
    const lifecycle = createMirrorLifecycle({
      start: vi.fn(),
      stop: vi.fn(),
      onStopError: vi.fn(),
    });
    const first = lifecycle.beginRun();
    const second = lifecycle.beginRun();

    expect(lifecycle.isCurrent(first)).toBe(false);
    expect(lifecycle.isCurrent(second)).toBe(true);
    expect(lifecycle.isSessionCurrent(first.sessionId)).toBe(false);
    expect(lifecycle.isSessionCurrent(second.sessionId)).toBe(true);
  });

  test("replaces and cancels startup deadlines", () => {
    vi.useFakeTimers();
    const lifecycle = createMirrorLifecycle({
      start: vi.fn(),
      stop: vi.fn(),
      onStopError: vi.fn(),
    });
    const first = vi.fn();
    const second = vi.fn();

    lifecycle.scheduleStartupTimeout(first, 100);
    lifecycle.scheduleStartupTimeout(second, 200);
    vi.advanceTimersByTime(150);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    lifecycle.invalidate();
    vi.advanceTimersByTime(100);
    expect(second).not.toHaveBeenCalled();
  });

  test("releases lease and reports cleanup failure once", async () => {
    const failure = new Error("stop failed");
    const onStopError = vi.fn();
    const lifecycle = createMirrorLifecycle({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockRejectedValue(failure),
      onStopError,
    });

    await lifecycle.acquireLease("device-1");
    expect(lifecycle.leaseSerial).toBe("device-1");
    await lifecycle.releaseLease();

    expect(lifecycle.leaseSerial).toBeNull();
    expect(onStopError).toHaveBeenCalledWith("device-1", failure);
  });
});
