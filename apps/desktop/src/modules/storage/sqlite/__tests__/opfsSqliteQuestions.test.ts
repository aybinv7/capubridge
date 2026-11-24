import { describe, expect, test, vi } from "vite-plus/test";

vi.mock("@/modules/storage/useAppPause", () => ({ PAUSE_COST: "The app is paused." }));
vi.mock("@/modules/storage/useLiveSqlite", () => ({ LIVE_COST: "The app keeps running." }));

const {
  danglingNote,
  deleteDatabaseQuestion,
  pauseInsteadQuestion,
  saveEditsQuestion,
  tablesQuestion,
  tablesSql,
} = await import("../opfsSqliteQuestions");
const { changesOnPage, sqliteEditReason } = await import("../browse/sqliteWriteAccess");

const notes = { name: "notes", tableType: "table" };
const odd = { name: 'we"ird', tableType: "table" };
const recent = { name: "recent", tableType: "view" };

describe("changes to the app's OPFS database", () => {
  test("only a database in the page's OPFS is changed on the phone", () => {
    expect(changesOnPage({ sourceKind: "opfs", sourceOpfsPath: "a.db" })).toBe(true);
    expect(changesOnPage({ sourceKind: "opfs" })).toBe(false);
    expect(changesOnPage({ sourceKind: "native-android", sourceOpfsPath: "a.db" })).toBe(false);
    expect(changesOnPage({ sourceKind: "jeep-sqlite", sourceOpfsPath: "a.db" })).toBe(false);
  });

  test("rows of a page OPFS database are editable; a pulled phone copy stays read-only", () => {
    expect(sqliteEditReason({ sourceKind: "opfs", sourceOpfsPath: "a.db" })).toBeNull();
    expect(sqliteEditReason({ sourceKind: "imported" })).toBeNull();
    expect(sqliteEditReason({ sourceKind: "native-android" })).toContain("read-only");
    expect(sqliteEditReason({ sourceKind: "opfs" })).toContain("read-only");
  });

  test("saving edits to the phone says how many, that a moved row stops it, and that the app keeps running", () => {
    const question = saveEditsQuestion("app.db", "notes", 3);
    expect(question.title).toBe("Save 3 changes to “notes” on the phone?");
    expect(question.text).toContain("nothing is saved");
    expect(question.text).toContain("The app keeps running.");
    expect(question.confirmLabel).toBe("Save to the phone");
    expect(saveEditsQuestion("app.db", "notes", 1).title).toBe(
      "Save 1 change to “notes” on the phone?",
    );
  });

  test("emptying quotes names and skips views; dropping drops a view as a view", () => {
    expect(tablesSql([notes, odd, recent], "empty")).toBe(
      'DELETE FROM "notes";\nDELETE FROM "we""ird";',
    );
    expect(tablesSql([notes, recent], "drop")).toBe('DROP TABLE "notes";\nDROP VIEW "recent";');
    expect(tablesSql([recent], "empty")).toBe("");
  });

  test("the questions name what goes and say the app keeps running", () => {
    const one = tablesQuestion("app.db", [notes], "drop");
    expect(one.title).toBe("Drop “notes”?");
    expect(one.text).toContain("The app keeps running.");
    expect(one.details).toBeUndefined();
    const many = tablesQuestion("app.db", [notes, odd], "empty");
    expect(many.title).toBe("Delete every row of 2 tables?");
    expect(many.details).toEqual(["notes", 'we"ird']);
  });

  test("deleting the database asks for its name to be typed", () => {
    const question = deleteDatabaseQuestion("PresalioStore.sqlite3", true);
    expect(question.requireConfirmText).toBe("PresalioStore.sqlite3");
    expect(question.text).toContain("pool keeps its size");
  });

  test("rows left pointing at removed rows are named, largest first, three at most", () => {
    expect(danglingNote([])).toBe("");
    expect(
      danglingNote([
        { table: "pack_item", parent: "product", rows: 28 },
        { table: "product_spec", parent: "product", rows: 16288 },
        { table: "product_image", parent: "product", rows: 4407 },
        { table: "stock_quant", parent: "product", rows: 1 },
      ]),
    ).toBe(
      "Left pointing at rows that are gone: 16,288 rows of “product_spec” into “product”, 4,407 rows of “product_image” into “product”, 28 rows of “pack_item” into “product”, and rows of 1 other table.",
    );
  });

  test("falling back to a pause says why the connection could not be used and what pausing costs", () => {
    const question = pauseInsteadQuestion(
      "app.db",
      "The app kept a transaction open on it for 2.0 s.",
    );
    expect(question.title).toBe("Pause the app to change “app.db”?");
    expect(question.text).toContain("transaction open on it for 2.0 s. Nothing was changed yet.");
    expect(question.text).toContain("The app is paused.");
    expect(question.danger).toBe(true);
  });
});
