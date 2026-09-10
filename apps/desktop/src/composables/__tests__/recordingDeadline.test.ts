import { describe, expect, test, vi } from "vite-plus/test";
import { recordingDeadline } from "../recordingDeadline";

describe("recordingDeadline", () => {
  test("rejects work that exceeds its deadline", async () => {
    vi.useFakeTimers();
    const pending = recordingDeadline(new Promise<void>(() => undefined), "Recorder stop", 100);
    const assertion = expect(pending).rejects.toThrow("Recorder stop timed out after 100ms");
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    vi.useRealTimers();
  });
});
