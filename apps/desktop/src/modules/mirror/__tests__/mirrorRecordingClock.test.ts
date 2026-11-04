import { describe, expect, it } from "vite-plus/test";
import { formatTimecode } from "../useMirrorRecordingClock";

describe("formatTimecode", () => {
  it.each([
    [0, "00:00"],
    [999, "00:00"],
    [61_000, "01:01"],
    [3_599_000, "59:59"],
    [3_661_000, "1:01:01"],
    [-50, "00:00"],
  ])("%i ms reads %s", (ms, text) => {
    expect(formatTimecode(ms)).toBe(text);
  });
});
