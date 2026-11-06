import { describe, expect, test } from "vite-plus/test";
import { formatSize } from "../fileSize";

describe("formatSize", () => {
  test("keeps one decimal below 10 of a unit and whole numbers above", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2.0 KB");
    expect(formatSize(14.3 * 1024 * 1024)).toBe("14 MB");
  });

  test("names an empty file by the chosen form and refuses non-sizes", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(0, false)).toBe("0 bytes");
    expect(formatSize(-1)).toBe("—");
    expect(formatSize(Number.NaN)).toBe("—");
  });
});
