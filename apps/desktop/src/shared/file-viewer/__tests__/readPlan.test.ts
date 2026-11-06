import { describe, expect, test } from "vite-plus/test";
import { READ_CAPS, formatBudget, planRead, truncationFor, truncationNote } from "../readPlan";

const MB = 1024 * 1024;

describe("planRead", () => {
  test("reads media whole and refuses it over its cap", () => {
    expect(planRead("image", 3 * MB)).toEqual({ mode: "read", maxBytes: 3 * MB });
    expect(planRead("image", 21 * MB)).toEqual({ mode: "too-large", cap: READ_CAPS.image });
    expect(planRead("video", 150 * MB)).toEqual({ mode: "read", maxBytes: 150 * MB });
    expect(planRead("audio", 201 * MB)).toEqual({ mode: "too-large", cap: READ_CAPS.media });
  });

  test("cuts text at 2 MB and probes everything else", () => {
    expect(planRead("text", 14 * MB)).toEqual({ mode: "read", maxBytes: READ_CAPS.text });
    expect(planRead("json", 512)).toEqual({ mode: "read", maxBytes: 512 });
    expect(planRead("binary", 80 * MB)).toEqual({ mode: "read", maxBytes: READ_CAPS.probe });
    expect(planRead("unknown", 300)).toEqual({ mode: "read", maxBytes: 300 });
  });

  test("reads one byte past the cap when the size is unknown", () => {
    expect(planRead("image", 0)).toEqual({ mode: "read", maxBytes: READ_CAPS.image + 1 });
    expect(planRead("text", -1)).toEqual({ mode: "read", maxBytes: READ_CAPS.text + 1 });
    expect(planRead("unknown", 0)).toEqual({ mode: "read", maxBytes: READ_CAPS.probe + 1 });
  });
});

describe("truncation", () => {
  test("is null when the whole file is on screen", () => {
    expect(truncationFor("text", 900, 900)).toBeNull();
    expect(truncationFor("text", 0, 900)).toBeNull();
  });

  test("knows the total when the listing gave a size", () => {
    expect(truncationFor("text", 14 * MB, READ_CAPS.text)).toEqual({
      shown: READ_CAPS.text,
      total: 14 * MB,
    });
  });

  test("detects a cut from the extra byte when the size is unknown", () => {
    expect(truncationFor("json", 0, READ_CAPS.text + 1)).toEqual({
      shown: READ_CAPS.text,
      total: null,
    });
  });

  test("reads as people say it", () => {
    expect(truncationNote({ shown: 2 * MB, total: 14.3 * MB })).toBe(
      "Showing the first 2 MB of 14 MB",
    );
    expect(truncationNote({ shown: 2 * MB, total: 3.4 * MB })).toBe(
      "Showing the first 2 MB of 3.4 MB",
    );
    expect(truncationNote({ shown: 1024, total: null })).toBe(
      "Showing the first 1 KB of a larger file",
    );
    expect(formatBudget(200 * MB)).toBe("200 MB");
  });
});
