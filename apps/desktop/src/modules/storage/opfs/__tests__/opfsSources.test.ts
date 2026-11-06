import { describe, expect, test } from "vite-plus/test";
import type { OPFSFolderNode, OPFSFolderTree } from "@capubridge/cdp-protocol";
import {
  buildOpfsSections,
  crumbsOf,
  normalizePath,
  parentOf,
  resolveFolder,
  visibleFolders,
} from "../opfsSources";

function node(path: string, files = 0, folders = 0): OPFSFolderNode {
  const parts = path.split("/").filter(Boolean);
  return { path, name: parts[parts.length - 1] ?? "", depth: parts.length, files, folders };
}

const FOLDERS = [
  node("", 2, 2),
  node("logs", 1),
  node(".opfs-sahpool", 0, 1),
  node(".opfs-sahpool/.opaque", 6),
  node(".opfs-sahpool/.opaque/old"),
];

const TREE: OPFSFolderTree = {
  origin: "https://app.test",
  available: true,
  folders: FOLDERS,
  truncated: false,
};

const settings = () => ({
  expanded: true,
  pinned: false,
  hidden: false,
  pinnedItems: [],
  hiddenItems: [],
});

describe("OPFS paths", () => {
  test("paths are written without stray slashes", () => {
    expect(normalizePath("/a//b/")).toBe("a/b");
    expect(parentOf("a/b/c")).toBe("a/b");
    expect(parentOf("a")).toBe("");
    expect(crumbsOf("a/b")).toEqual([
      { label: "OPFS", path: "" },
      { label: "a", path: "a" },
      { label: "b", path: "a/b" },
    ]);
  });

  test("a folder the walk did not see is missing, unless the walk stopped early", () => {
    expect(resolveFolder("/logs/", TREE)).toEqual({ path: "logs", missing: null });
    expect(resolveFolder("gone", TREE).missing).toMatch(/not in this page's OPFS/);
    expect(resolveFolder("gone", { ...TREE, truncated: true }).missing).toBeNull();
    expect(resolveFolder("gone", undefined).missing).toBeNull();
  });
});

describe("OPFS sidebar", () => {
  test("shows the top folders and opens the tree along the way to the open folder", () => {
    expect(visibleFolders(FOLDERS, "", false).map((folder) => folder.path)).toEqual([
      ".opfs-sahpool",
      "logs",
    ]);
    expect(visibleFolders(FOLDERS, ".opfs-sahpool/.opaque", false).map((f) => f.path)).toEqual([
      ".opfs-sahpool",
      ".opfs-sahpool/.opaque",
      ".opfs-sahpool/.opaque/old",
      "logs",
    ]);
  });

  test("a search lists every folder so deep matches are found", () => {
    expect(visibleFolders(FOLDERS, "", true)).toHaveLength(4);
  });

  test("one source for the page, folders indented in tree order with their counts", () => {
    const [section] = buildOpfsSections({
      tree: TREE,
      settings,
      open: ".opfs-sahpool",
      openCount: 9,
      searching: false,
    });
    const source = section?.sources[0];
    expect(source?.label).toBe("This page");
    expect(source?.detail).toBe("app.test");
    expect(source?.ordered).toBe(true);
    expect(source?.collections.map((c) => [c.id, c.depth, c.count])).toEqual([
      [".opfs-sahpool", 0, 9],
      [".opfs-sahpool/.opaque", 1, 6],
      ["logs", 0, 1],
    ]);
  });

  test("a page without OPFS says why instead of listing nothing", () => {
    const [section] = buildOpfsSections({
      tree: { ...TREE, available: false, reason: "Needs a secure page", folders: [] },
      settings,
      open: "",
      openCount: null,
      searching: false,
    });
    expect(section?.sources).toEqual([]);
    expect(section?.empty).toBe("Needs a secure page");
  });
});
