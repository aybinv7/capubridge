/** `"name"` with embedded quotes doubled, safe for any identifier. */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** An integer too wide for a JavaScript number, as the Rust side sends it. */
export interface SqliteWideInteger {
  __type: "Number";
  value: string;
}

/** A BLOB as the Rust side sends it: its size and its bytes in hex, maybe only the first ones. */
export interface SqliteBlob {
  __type: "Blob";
  size: number;
  hex: string;
  complete: boolean;
}

function isMarker(value: unknown): value is { __type: unknown } & Record<string, unknown> {
  return typeof value === "object" && value !== null && "__type" in value;
}

export function isWideInteger(value: unknown): value is SqliteWideInteger {
  return (
    isMarker(value) &&
    value.__type === "Number" &&
    typeof value["value"] === "string" &&
    /^-?\d+$/.test(value["value"])
  );
}

export function isSqliteBlob(value: unknown): value is SqliteBlob {
  return (
    isMarker(value) &&
    value.__type === "Blob" &&
    typeof value["hex"] === "string" &&
    typeof value["size"] === "number"
  );
}

/** Thrown when a value cannot be written as SQL because only part of it was read. */
export class SqlitePartialValueError extends Error {
  constructor(size: number) {
    super(
      `A BLOB of ${size.toLocaleString("en-US")} bytes was only partly read, so it cannot be written as SQL. Export the rows instead: exports read every byte.`,
    );
    this.name = "SqlitePartialValueError";
  }
}

/**
 * A SQL literal that reads back as the same value: wide integers in full, BLOBs as `X'…'`
 * (refused when only part of the bytes were read), text single-quoted with quotes doubled.
 */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (isWideInteger(value)) return value.value;
  if (isSqliteBlob(value)) {
    if (!value.complete) throw new SqlitePartialValueError(value.size);
    return `X'${value.hex}'`;
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
}

/** One `INSERT` per row, every value through `sqlLiteral`. */
export function toSqliteInserts(
  table: string,
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const head = `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES`;
  return rows.map((row) => `${head} (${row.map(sqlLiteral).join(", ")});`).join("\n");
}
