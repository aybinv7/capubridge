import { afterAll, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  OPFSFilesDomain,
  OPFSGoneError,
  OPFSWrongOriginError,
} from "../src/cdp/domains/opfs-files.ts";
import { FakeOpfsFolder, installOpfs } from "./opfs-fixture.ts";
import { PAGE, fakeOrigin, pageClient } from "./keyvalue-fixture.ts";

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

let root: FakeOpfsFolder;
let domain: OPFSFilesDomain;

beforeEach(() => {
  root = new FakeOpfsFolder();
  installOpfs(root);
  domain = new OPFSFilesDomain(pageClient({ [PAGE]: fakeOrigin() }));
});

afterAll(() => {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
});

function seed() {
  root.file("app.sqlite3", "SQLite format 3\0", 1000);
  root.file("app.sqlite3-wal", "wal", 2000);
  const pool = root.folder(".opfs-sahpool");
  pool.folder(".opaque").file("Xa9", "slot");
  root.folder("logs").file("today.log", "line 1\nline 2");
}

describe("OPFS files reads", () => {
  test("walks every folder breadth first with what each holds, opening no file", async () => {
    seed();
    const tree = await domain.folders();
    expect(tree.available).toBe(true);
    expect(tree.origin).toBe(PAGE);
    expect(tree.truncated).toBe(false);
    expect(tree.folders.map((folder) => [folder.path, folder.depth, folder.files])).toEqual([
      ["", 0, 2],
      [".opfs-sahpool", 1, 0],
      ["logs", 1, 1],
      [".opfs-sahpool/.opaque", 2, 1],
    ]);
  });

  test("says a page without OPFS has none instead of failing", async () => {
    installOpfs(undefined);
    const tree = await domain.folders();
    expect(tree.available).toBe(false);
    expect(tree.reason).toMatch(/secure page/);
    expect(tree.folders).toEqual([]);
  });

  test("lists a folder with sizes and dates, and a held-open file as locked", async () => {
    seed();
    const wal = root.children.get("app.sqlite3-wal");
    if (wal && "locked" in wal) wal.locked = true;
    const listing = await domain.folder("", PAGE);
    expect(listing.total).toBe(4);
    const byName = Object.fromEntries(listing.entries.map((entry) => [entry.name, entry]));
    expect(byName["app.sqlite3"]).toMatchObject({
      path: "app.sqlite3",
      kind: "file",
      size: 16,
      lastModified: 1000,
    });
    expect(byName["logs"]).toMatchObject({ kind: "directory", size: null });
    expect(byName["app.sqlite3-wal"]).toMatchObject({ locked: true, size: null });
  });

  test("names paths with quotes and line breaks safely", async () => {
    const odd = 'it\'s "odd"\n${x}';
    root.folder(odd).file("a.json", "{}");
    const listing = await domain.folder(odd);
    expect(listing.entries[0]?.path).toBe(`${odd}/a.json`);
  });

  test("a folder that is gone throws OPFSGoneError", async () => {
    await expect(domain.folder("nope")).rejects.toBeInstanceOf(OPFSGoneError);
  });

  test("refuses to read for another origin", async () => {
    await expect(domain.folder("", "https://other.test")).rejects.toBeInstanceOf(
      OPFSWrongOriginError,
    );
  });
});

describe("OPFS files deletes", () => {
  test("deletes the file the person saw", async () => {
    seed();
    const result = await domain.remove(PAGE, [
      { path: "logs/today.log", kind: "file", size: 13, lastModified: 1_700_000_000_000 },
    ]);
    expect(result.deleted).toEqual(["logs/today.log"]);
    expect(root.has("logs/today.log")).toBe(false);
  });

  test("keeps a file the app wrote since the read, until forced", async () => {
    seed();
    const target = { path: "app.sqlite3", kind: "file" as const, size: 16, lastModified: 1000 };
    const file = root.children.get("app.sqlite3");
    if (file && "write" in file) file.write(new TextEncoder().encode("SQLite format 3\0more"));
    const first = await domain.remove(PAGE, [target]);
    expect(first.changed).toEqual(["app.sqlite3"]);
    expect(root.has("app.sqlite3")).toBe(true);
    const forced = await domain.remove(PAGE, [target], true);
    expect(forced.deleted).toEqual(["app.sqlite3"]);
    expect(root.has("app.sqlite3")).toBe(false);
  });

  test("reports a file held open by the app as busy and keeps it", async () => {
    seed();
    const file = root.children.get("app.sqlite3");
    if (file && "locked" in file) file.locked = true;
    const result = await domain.remove(
      PAGE,
      [{ path: "app.sqlite3", kind: "file", size: null, lastModified: null }],
      true,
    );
    expect(result.busy).toEqual(["app.sqlite3"]);
    expect(root.has("app.sqlite3")).toBe(true);
  });

  test("deletes a folder with what is inside, and says what was already gone", async () => {
    seed();
    const result = await domain.remove(PAGE, [
      { path: ".opfs-sahpool", kind: "directory", size: null, lastModified: null },
      { path: "missing.json", kind: "file", size: 2, lastModified: 1 },
    ]);
    expect(result.deleted).toEqual([".opfs-sahpool"]);
    expect(result.gone).toEqual(["missing.json"]);
    expect(root.has(".opfs-sahpool/.opaque/Xa9")).toBe(false);
  });

  test("a file replaced by a folder of the same name is changed, not deleted", async () => {
    root.folder("cache");
    const result = await domain.remove(
      PAGE,
      [{ path: "cache", kind: "file", size: 1, lastModified: 1 }],
      true,
    );
    expect(result.changed).toEqual(["cache"]);
    expect(root.has("cache")).toBe(true);
  });

  test("changes nothing when the page shows another origin", async () => {
    seed();
    await expect(
      domain.remove("https://other.test", [
        { path: "logs", kind: "directory", size: null, lastModified: null },
      ]),
    ).rejects.toBeInstanceOf(OPFSWrongOriginError);
    expect(root.has("logs/today.log")).toBe(true);
  });
});
