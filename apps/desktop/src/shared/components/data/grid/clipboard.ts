import { cellToText } from "./valueFormat";

function escapeTsv(text: string): string {
  return /[\t\n\r"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Tab-separated text that spreadsheets paste as cells. Quotes fields containing
 * tabs, newlines or quotes (RFC 4180 style) so values survive the round trip.
 */
export function toTsv(rows: readonly (readonly unknown[])[], header?: readonly string[]): string {
  const lines: string[] = [];
  if (header) lines.push(header.map(escapeTsv).join("\t"));
  for (const row of rows) lines.push(row.map((value) => escapeTsv(cellToText(value))).join("\t"));
  return lines.join("\n");
}

/** Rows as a JSON array of objects keyed by column id. */
export function toJsonRows(
  rows: readonly (readonly unknown[])[],
  columns: readonly string[],
): string {
  return JSON.stringify(
    rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]]))),
    null,
    2,
  );
}
