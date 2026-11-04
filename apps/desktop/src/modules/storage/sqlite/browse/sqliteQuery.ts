export type SqliteExportFormat = "csv" | "json" | "sql";

/** `"name"` with embedded quotes doubled, safe for any identifier. */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** A SQL literal for a cell value; text is single-quoted with quotes doubled. */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
}

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
