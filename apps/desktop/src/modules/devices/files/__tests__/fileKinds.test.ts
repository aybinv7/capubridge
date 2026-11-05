import { describe, expect, test } from "vite-plus/test";
import type { FileEntry } from "@/types/adb.types";
import { entryKindLabel, fileViewerKind, formatFileEntrySize, formatSizeLabel } from "../fileKinds";

function entry(name: string, entryType: FileEntry["entryType"] = "file", size = 0): FileEntry {
  return { name, entryType, size, modified: "", permissions: "rw-r--r--" };
}

describe("fileKinds", () => {
  test("knows which files open in the viewer", () => {
    expect(fileViewerKind(entry("photo.JPG"))).toBe("image");
    expect(fileViewerKind(entry("clip.mp4"))).toBe("video");
    expect(fileViewerKind(entry("state.json"))).toBe("json");
    expect(fileViewerKind(entry("app.log"))).toBe("text");
    expect(fileViewerKind(entry("base.apk"))).toBe("binary");
    expect(fileViewerKind(entry("notes"))).toBe("unknown");
    expect(fileViewerKind(entry("Camera", "dir"))).toBeNull();
  });

  test("names kinds in plain words", () => {
    expect(entryKindLabel(entry("Camera", "dir"))).toBe("Folder");
    expect(entryKindLabel(entry("sdcard", "symlink"))).toBe("Link to a folder");
    expect(entryKindLabel(entry("base.apk"))).toBe("APK file");
    expect(entryKindLabel(entry("README"))).toBe("File");
  });

  test("sizes read as people say them", () => {
    expect(formatSizeLabel(entry("Camera", "dir"))).toBe("Folder");
    expect(formatSizeLabel(entry("a.bin", "file", 2048))).toBe("2.0 KB");
    expect(formatFileEntrySize(entry("a.bin", "file", 0), "Unknown")).toBe("Unknown");
  });
});
