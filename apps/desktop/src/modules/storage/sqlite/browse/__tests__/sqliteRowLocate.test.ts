import { createRequire } from "node:module";
import { beforeAll, describe, expect, test } from "vite-plus/test";
import initSqlJs, { type Database } from "sql.js";
import { buildPageQuery } from "../sqliteQuery";
import { locateRow, type RowLocateInput } from "../sqliteRowLocate";
import type { SqliteRowOrder } from "../sqliteRowOrder";

const require = createRequire(import.meta.url);
let db: Database;

beforeAll(async () => {
  const SQL = await initSqlJs({ locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm") });
  db = new SQL.Database();
  db.run(`CREATE TABLE item (id INTEGER PRIMARY KEY, state TEXT, qty INTEGER);
    WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 300)
    INSERT INTO item SELECT x, CASE x % 3 WHEN 0 THEN 'draft' WHEN 1 THEN 'done' ELSE 'sent' END,
      CASE WHEN x % 10 = 0 THEN NULL ELSE x % 7 END FROM c;
    CREATE TABLE pair (a INTEGER, b TEXT, v INTEGER, PRIMARY KEY (a, b)) WITHOUT ROWID;
    INSERT INTO pair SELECT id % 5, 'k' || id, qty FROM item;`);
});

const run = async (sql: string) => {
  const [result] = db.exec(sql);
  return { rows: result?.values ?? [] };
};

const ROWID: SqliteRowOrder = { kind: "terms", terms: ["rowid"] };

type Order = Omit<RowLocateInput, "match" | "keyColumns">;

function pageOrder(input: Order, select = "SELECT *"): unknown[][] {
  const sql = buildPageQuery({ ...input, offset: 0, limit: 100_000 }).replace("SELECT *", select);
  const [result] = db.exec(sql);
  return result?.values ?? [];
}

const cases: Order[] = [
  { table: "item", where: "", orderBy: null, direction: null, rowOrder: ROWID },
  { table: "item", where: "", orderBy: "state", direction: "ASC", rowOrder: ROWID },
  { table: "item", where: "", orderBy: "state", direction: "DESC", rowOrder: ROWID },
  { table: "item", where: "", orderBy: "qty", direction: "ASC", rowOrder: ROWID },
  { table: "item", where: "", orderBy: "qty", direction: "DESC", rowOrder: ROWID },
  { table: "item", where: `"state" <> 'done'`, orderBy: "qty", direction: "DESC", rowOrder: ROWID },
];

describe("go to a row", () => {
  test.each(cases)("lands where the pages put it: $orderBy $direction $where", async (input) => {
    const order = pageOrder(input, "SELECT id").map((row) => Number(row[0]));
    for (const id of [1, 10, 20, 150, 299, 300].filter((entry) => order.includes(entry))) {
      const found = await locateRow(run, { ...input, match: `"id" = ${id}`, keyColumns: ["id"] });
      expect(found).toEqual({ status: "found", position: order.indexOf(id), key: { id } });
    }
  });

  test("a row the filters hide, and a key that does not exist", async () => {
    const filtered = cases[5];
    if (!filtered) throw new Error("no case");
    expect(await locateRow(run, { ...filtered, match: `"id" = 1`, keyColumns: ["id"] })).toEqual({
      status: "hidden",
    });
    expect(await locateRow(run, { ...filtered, match: `"id" = 9999`, keyColumns: ["id"] })).toEqual(
      { status: "missing" },
    );
  });

  test("a WITHOUT ROWID table is ordered and found by its composite key", async () => {
    const input: Order = {
      table: "pair",
      where: "",
      orderBy: "v",
      direction: "DESC",
      rowOrder: { kind: "terms", terms: [`"a"`, `"b"`] },
    };
    const order = pageOrder(input, "SELECT a, b").map(
      (row) => `${String(row[0])}/${String(row[1])}`,
    );
    const found = await locateRow(run, {
      ...input,
      match: `"a" = 3 AND "b" = 'k123'`,
      keyColumns: ["a", "b"],
    });
    expect(found).toEqual({
      status: "found",
      position: order.indexOf("3/k123"),
      key: { a: 3, b: "k123" },
    });
  });

  test("a view cannot be searched by key", async () => {
    const found = await locateRow(run, {
      table: "v",
      where: "",
      orderBy: null,
      direction: null,
      rowOrder: { kind: "positions", count: 2 },
      match: "1",
      keyColumns: [],
    });
    expect(found).toMatchObject({ status: "unsupported" });
  });
});
