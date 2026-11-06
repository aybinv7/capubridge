import { describe, expect, test } from "vite-plus/test";
import { gridRowOf, shownRows } from "../opfsGrid";
import { isLiveDatabaseRole } from "../opfsModel";
import { file, folder, poolHint, row, rowsOf } from "./opfsFixtures";

describe("OPFS rows", () => {
  test("names each file by what it is for the app", () => {
    const rows = rowsOf(
      [
        folder(".opfs-sahpool"),
        file("app.sqlite3"),
        file("app.sqlite3-wal"),
        file("app.db-journal"),
        file("app.db-shm"),
        file("Xa9", 8192),
        file("settings.json"),
        file("README"),
      ],
      [poolHint(["Xa9"])],
    );
    expect(rows.map((entry) => entry.kindLabel)).toEqual([
      "Folder",
      "SQLite database",
      "Write-ahead log",
      "Rollback journal",
      "Shared memory",
      "SAH-Pool slot",
      "JSON file",
      "File",
    ]);
  });

  test("a slot holding only its header says it is empty", () => {
    expect(row(file("Xa9", 4096), [poolHint(["Xa9"])]).kindLabel).toBe("Empty SAH-Pool slot");
  });

  test("a small file the pool hint names is not a slot", () => {
    expect(row(file("Xa9", 100), [poolHint(["Xa9"])]).role).toBe("file");
  });

  test("database files and slots are live databases; plain files and folders are not", () => {
    expect(isLiveDatabaseRole("sqlite")).toBe(true);
    expect(isLiveDatabaseRole("wal")).toBe(true);
    expect(isLiveDatabaseRole("pool-slot")).toBe(true);
    expect(isLiveDatabaseRole("file")).toBe(false);
    expect(isLiveDatabaseRole("folder")).toBe(false);
  });

  test("the id is the path, so rows follow a file, never a position", () => {
    expect(row(file("logs/today.log")).id).toBe("logs/today.log");
  });
});

describe("OPFS grid", () => {
  const rows = rowsOf([
    file("b.json", 30),
    folder("zeta"),
    file("A.txt", 10),
    folder("alpha"),
    file("held.db", 0, { size: null, locked: true }),
  ]);

  test("folders come first, then names as people read them", () => {
    expect(shownRows(rows, "", null).map((entry) => entry.name)).toEqual([
      "alpha",
      "zeta",
      "A.txt",
      "b.json",
      "held.db",
    ]);
  });

  test("find matches names and kinds in any case", () => {
    expect(shownRows(rows, "JSON", null).map((entry) => entry.name)).toEqual(["b.json"]);
    expect(shownRows(rows, "folder", null).map((entry) => entry.name)).toEqual(["alpha", "zeta"]);
  });

  test("sorting by size puts unknown sizes last", () => {
    const sorted = shownRows(rows, "", { columnId: "size", direction: "asc" });
    expect(sorted.map((entry) => entry.name).slice(0, 2)).toEqual(["A.txt", "b.json"]);
  });

  test("sizes and dates read as words; a held-open file says it is in use", () => {
    const now = new Date(2026, 10, 6, 12).getTime();
    const cells = gridRowOf(row(file("a.bin", 2048, { lastModified: now - 60_000 })), now).cells;
    expect(cells["size"]).toBe("2 KB");
    expect(String(cells["modified"])).toMatch(/^Today at /);
    expect(gridRowOf(rows[4] ?? row(file("x"))).cells["size"]).toBe("In use");
    expect(gridRowOf(rows[1] ?? row(file("x"))).cells["size"]).toBe("—");
  });
});
