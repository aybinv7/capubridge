import { describe, test, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { useSessionWriter } from "../useSessionWriter";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

describe("useSessionWriter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test("push accumulates events in buffer", () => {
    const writer = useSessionWriter("session-1", 1_700_000_000_000);
    writer.push("network", { requestId: "abc", url: "https://example.com" });
    writer.push("console", { level: "error", text: "fail" });
    expect(writer.bufferSize()).toBe(2);
  });

  test("flush sends events to Rust and clears buffer", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const writer = useSessionWriter("session-1", 1_700_000_000_000);
    writer.push("network", { requestId: "abc" });
    await writer.flush();
    expect(invoke).toHaveBeenCalledWith(
      "recording_session_append",
      expect.objectContaining({
        sessionId: "session-1",
        track: "network",
      }),
    );
    expect(writer.bufferSize()).toBe(0);
  });

  test("events get t offset relative to startedAt", () => {
    const startedAt = 1_700_000_000_000;
    const writer = useSessionWriter("session-1", startedAt);
    const eventTime = startedAt + 5000;
    writer.pushAt("console", { text: "hello" }, eventTime);
    const ndjson = writer.drainAsNdjson("console");
    const parsed = JSON.parse(ndjson.trim());
    expect(parsed.t).toBe(5000);
  });

  test("flush is a no-op when buffer is empty", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const writer = useSessionWriter("session-1", 1_700_000_000_000);
    await writer.flush();
    expect(invoke).not.toHaveBeenCalled();
  });

  test("stop rejects and retains buffered events when persistence fails", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockRejectedValueOnce(new Error("disk full"));
    const writer = useSessionWriter("session-1", 1_700_000_000_000);
    writer.push("network", { requestId: "abc" });

    await expect(writer.stop()).rejects.toThrow("Recording flush failed");
    expect(writer.bufferSize()).toBe(1);

    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await writer.stop();
    expect(writer.bufferSize()).toBe(0);
  });

  test("serializes overlapping flush requests", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    let releaseFirst = () => {};
    const firstRequest = new Promise<void>((resolve) => {
      releaseFirst = () => resolve();
    });
    vi.mocked(invoke)
      .mockImplementationOnce(() => firstRequest)
      .mockResolvedValueOnce(undefined);
    const writer = useSessionWriter("session-1", 1_700_000_000_000);
    writer.push("network", { requestId: "first" });
    const first = writer.flush();
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    writer.push("network", { requestId: "second" });
    const second = writer.flush();

    releaseFirst();
    await Promise.all([first, second]);

    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
