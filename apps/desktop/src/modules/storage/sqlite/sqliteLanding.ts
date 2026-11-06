import { cellToText } from "@/shared/components/data/grid";

/**
 * A row to land on when a table opens: the row a link points at (its column and value), or a
 * key typed in quick open (`res_partner:4182`).
 */
export type SqliteLanding =
  | { kind: "link"; table: string; column: string; value: unknown; label: string }
  | { kind: "key"; table: string; key: string };

/** A link's landing, with the value as the person reads it. */
export function linkLanding(table: string, column: string, value: unknown): SqliteLanding {
  const label =
    value === null || value === undefined
      ? "NULL"
      : typeof value === "object" && "value" in value && typeof value.value === "string"
        ? value.value
        : cellToText(value);
  return { kind: "link", table, column, value, label };
}
