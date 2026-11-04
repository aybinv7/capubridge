import { cellToText } from "./valueFormat";

function csvField(value: unknown): string {
  const text = cellToText(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with a header row; NULL becomes an empty field. */
export function toCsv(columns: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [columns.map(csvField).join(","), ...rows.map((row) => row.map(csvField).join(","))].join(
    "\r\n",
  );
}

function sqlIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${cellToText(value).replace(/'/g, "''")}'`;
}

/** One `INSERT` per row, for "copy as INSERT" and SQL export. */
export function toSqlInserts(
  table: string,
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const head = `INSERT INTO ${sqlIdent(table)} (${columns.map(sqlIdent).join(", ")}) VALUES`;
  return rows.map((row) => `${head} (${row.map(sqlValue).join(", ")});`).join("\n");
}
