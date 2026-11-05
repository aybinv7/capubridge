import { describe, expect, test } from "vite-plus/test";
import type { FileEntry } from "@/types/adb.types";
import {
  ancestorPaths,
  breadcrumbs,
  joinPath,
  normalizePath,
  parentPath,
  sortEntries,
  visibleEntries,
  type DeviceFileListEntry,
} from "../filePaths";

function entry(
  name: string,
  entryType: FileEntry["entryType"],
  size = 0,
  modified = "",
): DeviceFileListEntry {
  return { name, entryType, size, modified, permissions: "rw-r--r--", path: `/x/${name}` };
}

describe("filePaths", () => {
  test("normalises, joins and walks up", () => {
    expect(normalizePath("  sdcard/Download/ ")).toBe("/sdcard/Download");
    expect(normalizePath("")).toBe("/");
    expect(joinPath("/", "sdcard")).toBe("/sdcard");
    expect(joinPath("/sdcard", "a")).toBe("/sdcard/a");
    expect(parentPath("/sdcard/a")).toBe("/sdcard");
    expect(parentPath("/sdcard")).toBe("/");
    expect(parentPath("/")).toBe("/");
  });

  test("crumbs and ancestors start at the root", () => {
    expect(breadcrumbs("/sdcard/Download").map((crumb) => crumb.label)).toEqual([
      "/",
      "sdcard",
      "Download",
    ]);
    expect(ancestorPaths("/data/local/tmp")).toEqual([
      "/",
      "/data",
      "/data/local",
      "/data/local/tmp",
    ]);
  });

  test("folders stay first whatever the column and direction", () => {
    const list = [
      entry("b.txt", "file", 5),
      entry("z", "dir"),
      entry("a.txt", "file", 50),
      entry("a", "symlink"),
    ];
    expect(sortEntries(list).map((e) => e.name)).toEqual(["a", "z", "a.txt", "b.txt"]);
    expect(sortEntries(list, { key: "size", desc: true }).map((e) => e.name)).toEqual([
      "z",
      "a",
      "a.txt",
      "b.txt",
    ]);
  });

  test("hides dot files unless asked and filters by name", () => {
    const raw: FileEntry[] = [
      entry(".nomedia", "file"),
      entry("Camera", "dir"),
      entry("notes.md", "file"),
    ];
    expect(
      visibleEntries(raw, "/sdcard", { showHidden: false, query: "" }).map((e) => e.path),
    ).toEqual(["/sdcard/Camera", "/sdcard/notes.md"]);
    expect(visibleEntries(raw, "/", { showHidden: true, query: "NO" }).map((e) => e.path)).toEqual([
      "/.nomedia",
      "/notes.md",
    ]);
  });
});
