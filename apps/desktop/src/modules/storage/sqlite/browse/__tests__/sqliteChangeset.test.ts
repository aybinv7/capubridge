import { describe, expect, test } from "vite-plus/test";
import {
  EMPTY_STAGED,
  addInsert,
  changesetStatements,
  readBackDifferences,
  stageCell,
  stageDeletes,
  stageInsertCell,
  stagedCount,
  uneditableReason,
} from "../sqliteChangeset";
import { readBackChangeset } from "../sqliteReadBack";
import { editorText, parseCellEdit } from "@/shared/components/data/grid/editors/cellEdit";

const row = { id: "[1]", cells: { id: 1, name: "tea", price: 2.5 } };
const wide = { __type: "Number", value: "9007199254740993" };

describe("staged SQLite edits", () => {
  test("an edited key still saves to the row it was read as", () => {
    let staged = stageCell(EMPTY_STAGED, row, "id", 7);
    staged = stageCell(staged, row, "name", "green tea");
    expect(changesetStatements("item", ["id"], staged)).toEqual([
      `UPDATE "item" SET "id" = 7, "name" = 'green tea' WHERE "id" IS 1`,
    ]);
  });

  test("a second edit of a row keeps the key it was first read with", () => {
    const first = stageCell(EMPTY_STAGED, row, "id", 7);
    const shown = { id: "[1]", cells: { ...row.cells, id: 7 } };
    const second = stageCell(first, shown, "price", 3);
    expect(changesetStatements("item", ["id"], second)).toEqual([
      `UPDATE "item" SET "id" = 7, "price" = 3 WHERE "id" IS 1`,
    ]);
  });

  test("keys and values wider than a JavaScript number are written in full", () => {
    const staged = stageCell(
      EMPTY_STAGED,
      { id: "k", cells: { id: wide, note: null } },
      "note",
      "x",
    );
    expect(changesetStatements("t", ["id"], staged)).toEqual([
      `UPDATE "t" SET "note" = 'x' WHERE "id" IS 9007199254740993`,
    ]);
  });

  test("setting a cell back to what was read leaves nothing to save", () => {
    const changed = stageCell(EMPTY_STAGED, row, "name", "green tea");
    expect(stagedCount(changed)).toBe(1);
    expect(stagedCount(stageCell(changed, row, "name", "tea"))).toBe(0);
  });

  test("a row read only in part cannot be addressed, so nothing is built", () => {
    const partial = { __type: "Blob", size: 9000, hex: "00", complete: false };
    const staged = stageCell(EMPTY_STAGED, { id: "b", cells: { id: partial, n: 1 } }, "n", 2);
    expect(() => changesetStatements("t", ["id"], staged)).toThrow(/only partly read/);
    expect(() => changesetStatements("t", [], stageCell(EMPTY_STAGED, row, "name", "x"))).toThrow(
      /no primary key/,
    );
  });

  test("new rows are inserted oldest first, an untouched one with its defaults", () => {
    let staged = addInsert(EMPTY_STAGED, "new:1");
    staged = stageInsertCell(staged, "new:1", "name", "scone");
    staged = addInsert(staged, "new:2");
    expect(changesetStatements("item", ["id"], staged)).toEqual([
      `INSERT INTO "item" ("name") VALUES ('scone')`,
      `INSERT INTO "item" DEFAULT VALUES`,
    ]);
  });

  test("BLOBs and wide integers are not edited as text", () => {
    expect(uneditableReason({ __type: "Blob", size: 3, hex: "00ff10", complete: true })).toMatch(
      /BLOB/,
    );
    expect(uneditableReason(wide)).toMatch(/wider/);
    expect(uneditableReason("tea")).toBeNull();
    expect(uneditableReason(null)).toBeNull();
  });
});

describe("reading saved rows back", () => {
  test("a value the file holds differently is reported", () => {
    expect(readBackDifferences({ price: "12" }, { price: 12 })).toEqual([
      { column: "price", wrote: "'12'", reads: "12" },
    ]);
    expect(readBackDifferences({ price: 12 }, { price: 12 })).toEqual([]);
    expect(readBackDifferences({ price: 12 }, null)[0]?.reads).toBe("no row with that key");
  });

  test("edited rows are read by their key after the save, new rows by their rowid", async () => {
    const queries: string[] = [];
    let staged = stageCell(EMPTY_STAGED, row, "id", 7);
    staged = addInsert(staged, "new:1");
    staged = stageInsertCell(staged, "new:1", "name", "scone");
    const back = await readBackChangeset(
      async (sql) => {
        queries.push(sql);
        return sql.includes("rowid")
          ? {
              columns: ["id", "name"],
              rows: [[8, "scone"]],
              rowCount: 1,
              changes: 0,
              durationMs: 0,
            }
          : { columns: ["id", "name"], rows: [[7, "tea"]], rowCount: 1, changes: 0, durationMs: 0 };
      },
      "item",
      ["id"],
      staged,
      [null, 8],
    );
    expect(queries).toEqual([
      `SELECT * FROM "item" WHERE "id" IS 7 LIMIT 1`,
      `SELECT * FROM "item" WHERE rowid = 8 LIMIT 1`,
    ]);
    expect(back.differences).toEqual([]);
    expect(back.inserted[0]?.row).toEqual({ id: 8, name: "scone" });
  });
});

describe("a multi-line text cell (S1)", () => {
  test("editing one other character saves every CRLF line break", () => {
    const note = { id: "[1]", cells: { id: 1, note: "first\r\nsecond" } };
    const parsed = parseCellEdit(
      note.cells.note,
      "multiline",
      `${editorText(note.cells.note, "multiline")}!`,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const staged = stageCell(EMPTY_STAGED, note, "note", parsed.value);
    expect(changesetStatements("item", ["id"], staged)).toEqual([
      `UPDATE "item" SET "note" = 'first\r\nsecond!' WHERE "id" IS 1`,
    ]);
  });

  test("a text mixing two kinds of line break is not edited inline", () => {
    expect(uneditableReason("a\r\nb\nc")).toMatch(/two kinds of line break/);
  });
});

describe("a typed integer past 2^53 (S4)", () => {
  test("is written and read back exactly on an insert of a wide key", async () => {
    const parsed = parseCellEdit(null, "number", "9007199254740993", 5, { exactIntegers: true });
    expect(parsed).toEqual({ ok: true, value: wide, changed: true });
    if (!parsed.ok) return;
    const staged = stageInsertCell(addInsert(EMPTY_STAGED, "new:1"), "new:1", "id", parsed.value);
    expect(changesetStatements("item", ["id"], staged)).toEqual([
      `INSERT INTO "item" ("id") VALUES (9007199254740993)`,
    ]);
    const exact = await readBackChangeset(
      async () => ({ columns: ["id"], rows: [[wide]], rowCount: 1, changes: 0, durationMs: 0 }),
      "item",
      ["id"],
      staged,
      [1],
    );
    expect(exact.differences).toEqual([]);
    const rounded = await readBackChangeset(
      async () => ({
        columns: ["id"],
        rows: [[{ __type: "Number", value: "9007199254740992" }]],
        rowCount: 1,
        changes: 0,
        durationMs: 0,
      }),
      "item",
      ["id"],
      staged,
      [1],
    );
    expect(rounded.differences).toEqual([
      { column: "id", wrote: "9007199254740993", reads: "9007199254740992", row: "new row 1" },
    ]);
  });

  test("past SQLite's 64-bit range, or typed so it would round, it is refused", () => {
    expect(parseCellEdit(1, "number", "9223372036854775808", 1, { exactIntegers: true }).ok).toBe(
      false,
    );
    expect(parseCellEdit(1, "number", "9007199254740993.0", 1, { exactIntegers: true }).ok).toBe(
      false,
    );
  });
});

describe("deleting rows (S6)", () => {
  test("a row with a NULL key is found with IS, one statement per row", () => {
    const rows = [
      { id: "[null]", cells: { id: null, name: "orphan" } },
      { id: "[1]", cells: { id: 1, name: "tea" } },
    ];
    expect(changesetStatements("item", ["id"], stageDeletes(EMPTY_STAGED, rows))).toEqual([
      `DELETE FROM "item" WHERE "id" IS NULL`,
      `DELETE FROM "item" WHERE "id" IS 1`,
    ]);
  });

  test("a thousand rows are a thousand one-row statements, not one OR chain", () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `[${i}]`, cells: { id: i } }));
    const statements = changesetStatements("item", ["id"], stageDeletes(EMPTY_STAGED, rows));
    expect(statements).toHaveLength(1000);
    expect(statements.every((sql) => !sql.includes(" OR "))).toBe(true);
  });

  test("the edits of a deleted row are dropped, and it is deleted by the key it was read with", () => {
    const edited = stageCell(EMPTY_STAGED, row, "id", 7);
    const staged = stageDeletes(edited, [{ id: row.id, cells: { ...row.cells, id: 7 } }]);
    expect(staged.edits.size).toBe(0);
    expect(changesetStatements("item", ["id"], staged)).toEqual([
      `DELETE FROM "item" WHERE "id" IS 1`,
    ]);
  });

  test("a deleted row still in the file reads back as a difference", async () => {
    const staged = stageDeletes(EMPTY_STAGED, [row]);
    const back = await readBackChangeset(
      async () => ({ columns: ["present"], rows: [[1]], rowCount: 1, changes: 0, durationMs: 0 }),
      "item",
      ["id"],
      staged,
      [null],
    );
    expect(back.differences).toEqual([
      { column: "(row)", wrote: "deleted", reads: "still there", row: "[1]" },
    ]);
  });
});
