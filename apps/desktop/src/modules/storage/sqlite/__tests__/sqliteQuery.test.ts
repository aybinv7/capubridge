import { describe, expect, test } from "vite-plus/test";
import {
  andWhere,
  buildCountQuery,
  buildPageQuery,
  predicate,
  quoteIdent,
  sqlLiteral,
} from "../browse/sqliteQuery";

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
});
