import { quoteIdent, sqlLiteral } from "../sqlText";

export { quoteIdent, sqlLiteral };

export type SqliteExportFormat = "csv" | "json" | "sql";
export type SqliteExportScope = "all" | "selected";

export type PredicateOperator = "=" | "!=" | "null" | "not-null";

/** One clause for "Filter = value" style context actions. */
export function predicate(column: string, operator: PredicateOperator, value?: unknown): string {
  const ident = quoteIdent(column);
  if (operator === "null") return `${ident} IS NULL`;
  if (operator === "not-null") return `${ident} IS NOT NULL`;
  if (value === null || value === undefined) {
    return operator === "=" ? `${ident} IS NULL` : `${ident} IS NOT NULL`;
  }
  return `${ident} ${operator === "=" ? "=" : "<>"} ${sqlLiteral(value)}`;
}

/** Adds a clause to an existing WHERE, keeping the user's text grouped. */
export function andWhere(current: string, clause: string): string {
  const trimmed = current.trim();
  return trimmed ? `(${trimmed}) AND ${clause}` : clause;
}

export interface PageQuery {
  table: string;
  where: string;
  orderBy: string | null;
  direction: "ASC" | "DESC" | null;
  offset: number;
  /** Rows to fetch; callers ask for one extra to learn whether another page exists. */
  limit: number;
}

function whereSql(where: string): string {
  const trimmed = where.trim().replace(/;+\s*$/, "");
  return trimmed ? ` WHERE (${trimmed})` : "";
}

export function buildPageQuery(query: PageQuery): string {
  const order =
    query.orderBy && query.direction
      ? ` ORDER BY ${quoteIdent(query.orderBy)} ${query.direction}`
      : "";
  const limit = Math.max(1, Math.floor(query.limit));
  const offset = Math.max(0, Math.floor(query.offset));
  return `SELECT * FROM ${quoteIdent(query.table)}${whereSql(query.where)}${order} LIMIT ${limit} OFFSET ${offset}`;
}

export function buildCountQuery(table: string, where: string): string {
  return `SELECT COUNT(*) AS total FROM ${quoteIdent(table)}${whereSql(where)}`;
}

export type ColumnFilterOperator =
  | PredicateOperator
  | "contains"
  | "starts"
  | "ends"
  | ">"
  | ">="
  | "<"
  | "<=";

/** LIKE escape character; `!` keeps patterns free of backslash ambiguity. */
const LIKE_ESCAPE = "!";

/** The value as a LIKE literal fragment: its own `%`, `_` and `!` match literally. */
function likePattern(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/[!%_]/g, (char) => `${LIKE_ESCAPE}${char}`);
}

function like(ident: string, pattern: string): string {
  return `${ident} LIKE ${sqlLiteral(pattern)} ESCAPE '${LIKE_ESCAPE}'`;
}

/** Clause for the column filter form; text matching is case-insensitive LIKE with escapes. */
export function columnFilter(
  column: string,
  operator: ColumnFilterOperator,
  value?: unknown,
): string {
  const ident = quoteIdent(column);
  switch (operator) {
    case "contains":
      return like(ident, `%${likePattern(value)}%`);
    case "starts":
      return like(ident, `${likePattern(value)}%`);
    case "ends":
      return like(ident, `%${likePattern(value)}`);
    case ">":
    case ">=":
    case "<":
    case "<=":
      return `${ident} ${operator} ${sqlLiteral(numericOr(value))}`;
    default:
      return predicate(column, operator, value);
  }
}

function numericOr(value: unknown): unknown {
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return value;
}

/** "Search all columns": any column whose text form contains the query. */
export function searchClause(columns: readonly string[], query: string): string {
  const needle = query.trim();
  if (!needle || columns.length === 0) return "";
  const pattern = `%${likePattern(needle)}%`;
  return `(${columns.map((column) => like(`CAST(${quoteIdent(column)} AS TEXT)`, pattern)).join(" OR ")})`;
}

/** Distinct values of one column with their row counts, most frequent first. */
export function buildGroupQuery(
  table: string,
  where: string,
  column: string,
  offset: number,
  limit: number,
): string {
  const ident = quoteIdent(column);
  return `SELECT ${ident}, COUNT(*) AS "rows" FROM ${quoteIdent(table)}${whereSql(where)} GROUP BY ${ident} ORDER BY "rows" DESC LIMIT ${Math.max(1, Math.floor(limit))} OFFSET ${Math.max(0, Math.floor(offset))}`;
}

export function buildGroupCountQuery(table: string, where: string, column: string): string {
  return `SELECT COUNT(*) AS total FROM (SELECT 1 FROM ${quoteIdent(table)}${whereSql(where)} GROUP BY ${quoteIdent(column)})`;
}
