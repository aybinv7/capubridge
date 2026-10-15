import { describe, expect, test } from "vite-plus/test";
import { parseSeekMs, resolveSeekMs } from "../replaySeek";

describe("parseSeekMs", () => {
  test("reads a millisecond offset", () => {
    expect(parseSeekMs("1500")).toBe(1500);
  });

  test("accepts zero", () => {
    expect(parseSeekMs("0")).toBe(0);
  });

  test("ignores an absent or empty value", () => {
    expect(parseSeekMs(undefined)).toBeNull();
    expect(parseSeekMs("")).toBeNull();
  });

  test("rejects a non-numeric value instead of coercing it to NaN", () => {
    expect(parseSeekMs("abc")).toBeNull();
  });

  test("rejects a negative offset", () => {
    expect(parseSeekMs("-1")).toBeNull();
  });

  test("rejects a repeated query param, which arrives as an array", () => {
    expect(parseSeekMs(["1", "2"])).toBeNull();
  });
});

describe("resolveSeekMs", () => {
  test("seeks to the start when nothing was requested", () => {
    expect(resolveSeekMs(null, 5000)).toBe(0);
  });

  test("seeks to the requested offset inside the session", () => {
    expect(resolveSeekMs(1500, 5000)).toBe(1500);
  });

  test("clamps an offset past the end to the end", () => {
    expect(resolveSeekMs(9000, 5000)).toBe(5000);
  });

  test("clamps to the start when the session reports no duration", () => {
    expect(resolveSeekMs(1500, 0)).toBe(0);
  });
});
