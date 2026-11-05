import { describe, expect, test } from "vite-plus/test";
import { modifiedCell, sizeCell } from "../fileCells";
import type { DeviceFileListEntry } from "../filePaths";

const NOW = new Date(2026, 10, 5, 17, 0).getTime();

function entry(patch: Partial<DeviceFileListEntry>): DeviceFileListEntry {
  return {
    name: "a.txt",
    path: "/sdcard/a.txt",
    size: 2048,
    modified: "2026-11-05 09:30",
    entryType: "file",
    permissions: "rw-rw----",
    ...patch,
  };
}

describe("file list cells", () => {
  test("an entry the shell cannot read says so instead of showing question marks", () => {
    const locked = entry({ name: "cache", modified: "", size: 0, noAccess: true });
    expect(modifiedCell(locked, NOW)).toBe("No access");
    expect(sizeCell(locked, true)).toBe("—");
  });

  test("dates read in words, the factory stamp and the epoch are explained", () => {
    expect(modifiedCell(entry({}), NOW)).toBe("Today at 09:30");
    expect(modifiedCell(entry({ modified: "2009-01-01 01:00" }), NOW)).toBe("Came with the phone");
    expect(modifiedCell(entry({ modified: "1970-01-01 00:00" }), NOW)).toBe("Unknown");
  });

  test("folders have no size; search results have unknown sizes", () => {
    expect(sizeCell(entry({ entryType: "dir" }), true)).toBe("—");
    expect(sizeCell(entry({ size: 0 }), false)).toBe("Unknown");
  });
});
