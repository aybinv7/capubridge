import type { SqliteQueryResult } from "@/types/sqlite.types";
import { quoteIdent } from "../sqlText";
import type { SqliteRowOrder } from "./sqliteRowOrder";

export interface RowLocateInput {
  table: string;
  /** The filters on screen (chips, WHERE, search), already joined. */
  where: string;
  orderBy: string | null;
  direction: "ASC" | "DESC" | null;
  rowOrder: SqliteRowOrder;
  /** SQL that picks the row, e.g. `"id" = 4182`; the first match is the one found. */
  match: string;
  /** Primary-key columns, read back to name the row in the grid. */
  keyColumns: readonly string[];
}

export type RowLocation =
  | { status: "found"; position: number; key: Record<string, unknown> }
  | { status: "missing" }
  | { status: "hidden" }
  | { status: "unsupported"; reason: string };

const SORT = `"__capu_s"`;
const term = (index: number) => `"__capu_k${index}"`;
const keyAlias = (index: number) => `"__capu_p${index}"`;
const fromTarget = (alias: string) => `(SELECT ${alias} FROM target)`;

function clean(sql: string): string {
  return sql.trim().replace(/;+\s*$/, "");
}

/** Rows whose tie-break terms come before the target's, in the order's direction. */
function termsBefore(terms: readonly string[], dir: "ASC" | "DESC"): string {
  const op = dir === "ASC" ? "<" : ">";
  const alternatives = terms.map((expr, index) => {
    const equal = terms.slice(0, index).map((left, at) => `${left} = ${fromTarget(term(at))}`);
    return [...equal, `${expr} ${op} ${fromTarget(term(index))}`].join(" AND ");
  });
  return alternatives.map((part) => `(${part})`).join(" OR ");
}

function termsEqual(terms: readonly string[]): string {
  return terms.map((expr, index) => `${expr} IS ${fromTarget(term(index))}`).join(" AND ");
}

/**
 * One read-only query that finds a row and where it falls under the current order and filters:
 * whether it exists, whether the filters hide it, and how many rows come before it (NULLs first
 * when ascending, last when descending, as SQLite sorts them). Ordering ties are broken by the
 * same row order the pages use, so the position matches the page it is read on.
 */
export function buildRowLocateQuery(input: RowLocateInput): string | null {
  if (input.rowOrder.kind !== "terms") return null;
  const terms = input.rowOrder.terms;
  const table = quoteIdent(input.table);
  const where = clean(input.where);
  const filtered = where ? `(${where}) AND ` : "";
  const sorted = input.orderBy !== null && input.direction !== null;
  const dir = sorted ? (input.direction ?? "ASC") : "ASC";
  const selected = [
    ...(sorted && input.orderBy ? [`${quoteIdent(input.orderBy)} AS ${SORT}`] : []),
    ...terms.map((expr, index) => `${expr} AS ${term(index)}`),
    ...input.keyColumns.map((column, index) => `${quoteIdent(column)} AS ${keyAlias(index)}`),
  ];
  let before = termsBefore(terms, dir);
  if (sorted && input.orderBy) {
    const column = quoteIdent(input.orderBy);
    const value = fromTarget(SORT);
    const nulls =
      dir === "ASC"
        ? `(${column} IS NULL AND ${value} IS NOT NULL)`
        : `(${value} IS NULL AND ${column} IS NOT NULL)`;
    const op = dir === "ASC" ? "<" : ">";
    before = `(${column} ${op} ${value}) OR ${nulls} OR (${column} IS ${value} AND (${before}))`;
  }
  const keys = input.keyColumns.map(
    (_, index) => `${fromTarget(keyAlias(index))} AS ${keyAlias(index)}`,
  );
  return [
    `WITH target AS (SELECT ${selected.join(", ")} FROM ${table} WHERE (${clean(input.match)}) LIMIT 1)`,
    `SELECT (SELECT COUNT(*) FROM target) AS "found",`,
    `(SELECT COUNT(*) FROM ${table} WHERE ${filtered}${termsEqual(terms)}) AS "shown",`,
    `(SELECT COUNT(*) FROM ${table} WHERE ${filtered}(${before})) AS "before"${keys.length ? `, ${keys.join(", ")}` : ""}`,
  ].join(" ");
}

/** Reads the answer of `buildRowLocateQuery`. */
export function readRowLocation(
  result: Pick<SqliteQueryResult, "rows">,
  keyColumns: readonly string[],
): RowLocation {
  const row = result.rows[0];
  if (!row || row[0] !== 1) return { status: "missing" };
  if (row[1] === 0) return { status: "hidden" };
  const before = row[2];
  if (typeof before !== "number") return { status: "missing" };
  const key = Object.fromEntries(keyColumns.map((column, index) => [column, row[3 + index]]));
  return { status: "found", position: before, key };
}

/** Finds a row with one query; `run` reads the open copy. */
export async function locateRow(
  run: (sql: string) => Promise<Pick<SqliteQueryResult, "rows">>,
  input: RowLocateInput,
): Promise<RowLocation> {
  const sql = buildRowLocateQuery(input);
  if (!sql) {
    return {
      status: "unsupported",
      reason: "A view has no key, so a row of it can only be reached by its number.",
    };
  }
  return readRowLocation(await run(sql), input.keyColumns);
}
