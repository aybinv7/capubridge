import { describe, expect, test } from "vite-plus/test";
import type { SqliteDbFile, SqliteTableInfo } from "@/types/sqlite.types";
import type { LocalSqlSession } from "@/stores/sqlSession.store";
import { buildDataTree } from "@/modules/storage/frame/dataTreeModel";
import type { DataTreeRow } from "@/modules/storage/frame/dataFrame.types";
import type { SourceSettings } from "@/modules/storage/frame/useDataSidebarSettings";
import { addressOf } from "../sqliteAddress";
import { findDatabase } from "../sqliteDatabaseRef";
import { buildSqliteSections, fileSourceId } from "../sqliteTree";
import { sqliteTreeActions } from "../sqliteTreeActions";

const native: SqliteDbFile = {
  name: "app.db",
  path: "/data/data/com.shop/databases/app.db",
  size: 4096,
  sourceKind: "native-android",
};
const opfs: SqliteDbFile = {
  name: "app.db",
  path: "opfs:/sqlite/app.db",
  size: 8192,
  sourceKind: "opfs",
  sourceOpfsPath: "/sqlite/app.db",
  sourceOpfsDirectory: "sqlite",
};
const file: SqliteDbFile = {
  name: "dump.sqlite",
  path: "C:/Temp/capubridge-sqlite/opfs-1-0-dump.sqlite",
  size: 100,
  sourceKind: "imported",
};

const table = (name: string): SqliteTableInfo => ({
  name,
  tableType: "table",
  rowCount: 3,
  sql: "",
});

function settings(overrides: Record<string, Partial<SourceSettings>> = {}) {
  return (sourceId: string): SourceSettings => ({
    pinned: false,
    hidden: false,
    expanded: false,
    pinnedItems: [],
    hiddenItems: [],
    ...overrides[sourceId],
  });
}

function sections(open: { sourceId: string; tables: SqliteTableInfo[] } | null, s = settings()) {
  return buildSqliteSections({
    databases: [native, opfs],
    files: [{ sourceId: fileSourceId("f1"), db: file }],
    open,
    settings: s,
    databaseChanges: () => undefined,
    tableChanges: () => undefined,
    phoneListed: true,
  });
}

const session = {
  serial: "__local__",
  package: "opfs",
  dbPath: "C:/Temp/opfs-pull.db",
  sourceKind: "opfs",
  sourceOpfsPath: "/sqlite/app.db",
} as LocalSqlSession;

describe("addressOf (C16)", () => {
  const reach = { device: { serial: "R5", package: "com.shop" }, session };

  test("a phone database is read on the phone even while a page copy is open", () => {
    expect(addressOf(native, reach)).toEqual({
      serial: "R5",
      package: "com.shop",
      path: native.path,
    });
  });

  test("a page database is read through its pulled copy, and not at all before", () => {
    expect(addressOf(opfs, reach)).toEqual({
      serial: "__local__",
      package: "opfs",
      path: session.dbPath,
    });
    expect(addressOf(opfs, { ...reach, session: null })).toBeNull();
  });

  test("an opened file is read through itself, phone or not", () => {
    expect(addressOf(file, { device: null, session: null })?.path).toBe(file.path);
  });
});

describe("findDatabase (C22)", () => {
  test("a path names one database even when two share a name", () => {
    expect(findDatabase(opfs.path, [native, opfs])?.db).toBe(opfs);
    expect(findDatabase(native.path, [native, opfs])?.db).toBe(native);
  });

  test("an old link by name opens the phone database once, and says it was a name", () => {
    expect(findDatabase("app.db", [native, opfs])).toEqual({ db: native, byName: true });
    expect(findDatabase("missing.db", [native, opfs])).toBeNull();
  });

  test("a name two phone databases share opens neither", () => {
    expect(findDatabase("app.db", [native, { ...native, path: "/other/app.db" }])).toBeNull();
  });

  test("names with % are taken as they are, never decoded twice (C5)", () => {
    const odd = { ...native, name: "50%off.db", path: "/data/data/com.shop/databases/50%off.db" };
    expect(findDatabase("50%off.db", [odd])?.db).toBe(odd);
  });
});

describe("buildSqliteSections (C23)", () => {
  test("only the open database lists tables, so a search never matches another one's", () => {
    const tree = buildDataTree(
      sections(
        { sourceId: native.path, tables: [table("orders"), table("lines")] },
        settings({ [opfs.path]: { expanded: true } }),
      ),
      { search: "orders", showHidden: false },
    );
    const collections = tree.rows.filter((row) => row.kind === "collection");
    expect(collections).toHaveLength(1);
    expect(collections[0]?.kind === "collection" && collections[0].source.id).toBe(native.path);
  });

  test("pins and hidden tables follow the database's path, not its copy", () => {
    const model = sections(
      { sourceId: opfs.path, tables: [table("a"), table("b")] },
      settings({ [opfs.path]: { hiddenItems: ["b"] } }),
    );
    const tree = buildDataTree(model, { search: "", showHidden: false });
    expect(tree.hiddenCollections).toBe(1);
    const page = model.find((section) => section.id === "page");
    expect(page?.sources[0]?.id).toBe(opfs.path);
  });

  test("files opened here sit in their own group with an imported mark", () => {
    const files = sections(null).find((section) => section.id === "files");
    expect(files?.sources[0]).toMatchObject({ id: "file:f1", provenance: "imported" });
  });
});

describe("sqliteTreeActions (M1)", () => {
  function row(sourceId: string, kind: "source" | "collection"): DataTreeRow {
    const source = {
      id: sourceId,
      label: "x",
      provenance: "local" as const,
      collections: [],
      expanded: true,
    };
    return kind === "source"
      ? { kind, key: sourceId, source, sectionId: "s" }
      : { kind, key: sourceId, source, collection: { id: "t", label: "t" }, sectionId: "s" };
  }

  const byId: Record<string, SqliteDbFile> = {
    [native.path]: native,
    [opfs.path]: opfs,
    "file:f1": file,
  };
  const context = {
    databaseOf: (id: string) => byId[id] ?? null,
    unreadableReason: () => null,
    openSourceId: "file:f1",
  };
  const ids = (sourceId: string, kind: "source" | "collection") =>
    sqliteTreeActions(row(sourceId, kind), context).map((action) => action.id);

  test("with a file open, a phone or page database offers nothing that changes data", () => {
    for (const sourceId of [native.path, opfs.path]) {
      expect(ids(sourceId, "source")).not.toContain("import-dump");
      expect(ids(sourceId, "source")).not.toContain("close-file");
      expect(ids(sourceId, "collection")).not.toContain("clear-rows");
      expect(ids(sourceId, "collection")).not.toContain("drop-table");
    }
  });

  test("an opened file is closed, not deleted, and only it can be replaced or cleared", () => {
    expect(ids("file:f1", "source")).toEqual(expect.arrayContaining(["import-dump", "close-file"]));
    expect(ids("file:f1", "source")).not.toContain("delete");
    expect(ids("file:f1", "collection")).toEqual(
      expect.arrayContaining(["clear-rows", "drop-table"]),
    );
  });
});
