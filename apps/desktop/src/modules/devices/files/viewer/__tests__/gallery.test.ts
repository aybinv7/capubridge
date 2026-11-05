import { describe, expect, test } from "vite-plus/test";
import type { FileEntry } from "@/types/adb.types";
import type { DeviceFileListEntry } from "../../filePaths";
import { galleryEntries, galleryNeighbour, galleryPosition } from "../gallery";

function entry(name: string, entryType: FileEntry["entryType"] = "file"): DeviceFileListEntry {
  return { name, entryType, size: 1, modified: "", permissions: "", path: `/sdcard/${name}` };
}

const listing = [
  entry("DCIM", "dir"),
  entry("a.png"),
  entry("socket", "other"),
  entry("b.log"),
  entry("c.apk"),
];

describe("gallery", () => {
  test("steps through every regular file, not folders or special files", () => {
    expect(galleryEntries(listing).map((item) => item.name)).toEqual(["a.png", "b.log", "c.apk"]);
  });

  test("knows where the open file sits", () => {
    const items = galleryEntries(listing);
    expect(galleryPosition(items, "/sdcard/b.log")).toEqual({ index: 1, total: 3 });
    expect(galleryPosition(items, "/sdcard/DCIM")).toEqual({ index: -1, total: 3 });
    expect(galleryPosition(items, null)).toEqual({ index: -1, total: 3 });
  });

  test("wraps at both ends", () => {
    const items = galleryEntries(listing);
    expect(galleryNeighbour(items, "/sdcard/c.apk", "next")?.name).toBe("a.png");
    expect(galleryNeighbour(items, "/sdcard/a.png", "prev")?.name).toBe("c.apk");
    expect(galleryNeighbour(items, "/sdcard/a.png", "next")?.name).toBe("b.log");
  });

  test("goes nowhere alone or from outside the gallery", () => {
    expect(galleryNeighbour([entry("only.txt")], "/sdcard/only.txt", "next")).toBeNull();
    expect(galleryNeighbour(galleryEntries(listing), "/elsewhere", "next")).toBeNull();
  });
});
