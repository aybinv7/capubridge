import { describe, expect, it } from "vite-plus/test";
import { EMPTY_FRAME_READING } from "../mirrorFrameClock";
import {
  deriveMirrorPhase,
  describeMirrorError,
  describeMirrorStatus,
  formatFrameAge,
  STILL_AFTER_MS,
  type MirrorStatusInput,
} from "../mirrorStatus";

function input(overrides: Partial<MirrorStatusInput> = {}): MirrorStatusInput {
  return {
    active: true,
    isConnected: true,
    error: null,
    frames: { fps: 24, lastFrameAt: 1000, ageMs: 40 },
    ...overrides,
  };
}

describe("deriveMirrorPhase", () => {
  it("an error wins over everything", () => {
    expect(deriveMirrorPhase(input({ error: "boom", active: false }))).toBe("error");
  });

  it("is off when the panel does not want a stream", () => {
    expect(deriveMirrorPhase(input({ active: false }))).toBe("off");
  });

  it("is starting until the transport connects", () => {
    expect(deriveMirrorPhase(input({ isConnected: false }))).toBe("starting");
  });

  it("waits for the first frame once connected", () => {
    expect(deriveMirrorPhase(input({ frames: EMPTY_FRAME_READING }))).toBe("waiting");
  });

  it("is live while frames are fresh and still once they stop", () => {
    const fresh = { fps: 3, lastFrameAt: 0, ageMs: STILL_AFTER_MS };
    const old = { fps: 0, lastFrameAt: 0, ageMs: STILL_AFTER_MS + 1 };
    expect(deriveMirrorPhase(input({ frames: fresh }))).toBe("live");
    expect(deriveMirrorPhase(input({ frames: old }))).toBe("still");
  });
});

describe("describeMirrorStatus", () => {
  it("shows the frame rate while live", () => {
    expect(describeMirrorStatus(input())).toMatchObject({
      label: "Live",
      meta: "24 fps",
      dotColor: "lime",
    });
  });

  it("says how long the picture has not changed, without calling it broken", () => {
    const status = describeMirrorStatus(
      input({ frames: { fps: 0, lastFrameAt: 0, ageMs: 12_400 } }),
    );
    expect(status).toMatchObject({ label: "Unchanged", meta: "12 s", dotColor: undefined });
    expect(status.description).toMatch(/only sends a frame when the picture changes/);
  });

  it("uses the translated error title as its description", () => {
    const status = describeMirrorStatus(
      input({ error: "IpcError: Timeout waiting for scrcpy video stream" }),
    );
    expect(status).toMatchObject({ label: "Stopped", dotColor: "red" });
    expect(status.description).toBe("The device sent no picture");
  });

  it("is hollow when off", () => {
    expect(describeMirrorStatus(input({ active: false }))).toMatchObject({
      label: "Off",
      dotVariant: "hollow",
    });
  });
});

describe("formatFrameAge", () => {
  it.each([
    [400, "<1 s"],
    [1000, "1 s"],
    [59_999, "59 s"],
    [60_000, "1 min"],
    [3_600_000, "1 h"],
  ])("%i ms reads %s", (ms, text) => {
    expect(formatFrameAge(ms)).toBe(text);
  });
});

describe("describeMirrorError", () => {
  it("strips the IPC prefix and keeps the raw text as detail", () => {
    const copy = describeMirrorError("IpcError: Timeout waiting for scrcpy video stream");
    expect(copy.detail).toBe("Timeout waiting for scrcpy video stream");
    expect(copy.hint).toMatch(/Wake and unlock/);
  });

  it.each([
    ["device unauthorized", "USB debugging is not allowed yet"],
    ["WebCodecs is not available on this platform.", "This computer cannot decode the stream"],
    ["codec not supported: avc1", "This computer cannot decode the stream"],
    ["Select target or online Android device before starting mirror.", "No device to show"],
    ["error: device 'abc' not found", "The device is not reachable"],
    ["scrcpy stream disconnected", "The stream disconnected"],
  ])("%s → %s", (raw, title) => {
    expect(describeMirrorError(raw).title).toBe(title);
  });

  it("falls back to a generic title with a next step", () => {
    const copy = describeMirrorError("something odd");
    expect(copy.title).toBe("The screen stream stopped");
    expect(copy.hint).toMatch(/Restart the stream/);
  });
});
