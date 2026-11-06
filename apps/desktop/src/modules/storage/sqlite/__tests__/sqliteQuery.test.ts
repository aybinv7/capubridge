import { describe, expect, test } from "vite-plus/test";
import {
  andWhere,
  buildGroupCountQuery,
  buildGroupQuery,
  columnFilter,
  searchClause,
  buildCountQuery,
  buildPageQuery,
  predicate,
  quoteIdent,
  sqlLiteral,
} from "../browse/sqliteQuery";
import { orderSql, rowOrderOf } from "../browse/sqliteRowOrder";

describe("quoting", () => {
  test("identifiers and literals cannot break out of their quotes", () => {
    expect(quoteIdent('we"ird')).toBe('"we""ird"');
    expect(sqlLiteral("it's")).toBe("'it''s'");
    expect(sqlLiteral(null)).toBe("NULL");
    expect(sqlLiteral(Number.NaN)).toBe("NULL");
    expect(sqlLiteral(true)).toBe("1");
    expect(sqlLiteral({ a: 1 })).toBe(`'{"a":1}'`);
  });
});

describe("predicate", () => {
  test("builds equality, inequality and NULL tests", () => {
    expect(predicate("state", "=", "done")).toBe(`"state" = 'done'`);
    expect(predicate("qty", "!=", 3)).toBe(`"qty" <> 3`);
    expect(predicate("note", "=", null)).toBe(`"note" IS NULL`);
    expect(predicate("note", "not-null")).toBe(`"note" IS NOT NULL`);
  });

  test("andWhere keeps the user's text grouped", () => {
    expect(andWhere("", `"a" = 1`)).toBe(`"a" = 1`);
    expect(andWhere("x = 1 OR y = 2", `"a" = 1`)).toBe(`(x = 1 OR y = 2) AND "a" = 1`);
  });
});

describe("page and count queries", () => {
  test("filter, order and page on the database, not on the visible page", () => {
    expect(
      buildPageQuery({
        table: "sale_order",
        where: "state = 'draft';",
        orderBy: "date",
        direction: "DESC",
        offset: 100,
        limit: 51,
      }),
    ).toBe(
      `SELECT * FROM "sale_order" WHERE (state = 'draft') ORDER BY "date" DESC LIMIT 51 OFFSET 100`,
    );
    expect(buildCountQuery("sale_order", "")).toBe(`SELECT COUNT(*) AS total FROM "sale_order"`);
  });

  test("equal sort values are broken by the row order, in the sort's direction", () => {
    const page = (orderBy: string | null, direction: "ASC" | "DESC" | null) =>
      buildPageQuery({
        table: "t",
        where: "x = 1",
        orderBy,
        direction,
        offset: 0,
        limit: 51,
        rowOrder: { kind: "terms", terms: ["rowid"] },
      });
    expect(page("state", "DESC")).toBe(
      `SELECT * FROM "t" WHERE (x = 1) ORDER BY "state" DESC, rowid DESC LIMIT 51 OFFSET 0`,
    );
    expect(page(null, null)).toBe(
      `SELECT * FROM "t" WHERE (x = 1) ORDER BY rowid ASC LIMIT 51 OFFSET 0`,
    );
  });
});

describe("row order", () => {
  const table = (sql: string, tableType = "table") => ({ tableType, sql });
  const col = (name: string, pk = 0) => ({ name, pk });

  test("a rowid table is ordered by its rowid, under a name no column takes", () => {
    expect(rowOrderOf(table("CREATE TABLE t (id INTEGER PRIMARY KEY)"), [col("id", 1)])).toEqual({
      kind: "terms",
      terms: ["rowid"],
    });
    expect(rowOrderOf(table("CREATE TABLE t (rowid, oid)"), [col("rowid"), col("oid")])).toEqual({
      kind: "terms",
      terms: ["_rowid_"],
    });
  });

  test("a WITHOUT ROWID table is ordered by its primary key in declared order", () => {
    const sql = "CREATE TABLE p (a, b, PRIMARY KEY (b, a)) WITHOUT ROWID";
    expect(rowOrderOf(table(sql), [col("a", 2), col("b", 1)])).toEqual({
      kind: "terms",
      terms: [`"b"`, `"a"`],
    });
  });

  test("a view breaks ties by every column, and only under a sort", () => {
    const order = rowOrderOf(table("CREATE VIEW v AS SELECT 1", "view"), [col("a"), col("b")]);
    expect(orderSql("a", "DESC", order)).toBe(' ORDER BY "a" DESC, 1 DESC, 2 DESC');
    expect(orderSql(null, null, order)).toBe("");
  });
});

describe("column filter, search and grouping", () => {
  test("LIKE operators escape wildcards in the user's value", () => {
    expect(columnFilter("name", "contains", "50%_off!")).toBe(
      `"name" LIKE '%50!%!_off!!%' ESCAPE '!'`,
    );
    expect(columnFilter("name", "starts", "it's")).toBe(`"name" LIKE 'it''s%' ESCAPE '!'`);
    expect(columnFilter("qty", ">=", "10")).toBe(`"qty" >= 10`);
    expect(columnFilter("note", "null")).toBe(`"note" IS NULL`);
  });

  test("search matches any column's text form", () => {
    expect(searchClause(["a", "b"], " kg ")).toBe(
      `(CAST("a" AS TEXT) LIKE '%kg%' ESCAPE '!' OR CAST("b" AS TEXT) LIKE '%kg%' ESCAPE '!')`,
    );
    expect(searchClause(["a"], "  ")).toBe("");
  });

  test("group by counts rows per value on the database", () => {
    expect(buildGroupQuery("t", "x > 1", "state", 0, 51)).toBe(
      `SELECT "state", COUNT(*) AS "rows" FROM "t" WHERE (x > 1) GROUP BY "state" ORDER BY "rows" DESC, "state" LIMIT 51 OFFSET 0`,
    );
    expect(buildGroupCountQuery("t", "", "state")).toBe(
      `SELECT COUNT(*) AS total FROM (SELECT 1 FROM "t" GROUP BY "state")`,
    );
  });
});

describe("exact values (C18, C19)", () => {
  test("an integer past 2^53 is written with every digit", () => {
    const wide = { __type: "Number", value: "9007199254740993" };
    expect(sqlLiteral(wide)).toBe("9007199254740993");
    expect(predicate("id", "=", wide)).toBe(`"id" = 9007199254740993`);
  });

  test("a BLOB is written as its bytes, never as its description", () => {
    expect(sqlLiteral({ __type: "Blob", size: 3, hex: "00ff10", complete: true })).toBe(
      "X'00ff10'",
    );
  });

  test("a BLOB read only in part is refused instead of written short", () => {
    expect(() => sqlLiteral({ __type: "Blob", size: 9000, hex: "00", complete: false })).toThrow(
      /only partly read/,
    );
  });
});
