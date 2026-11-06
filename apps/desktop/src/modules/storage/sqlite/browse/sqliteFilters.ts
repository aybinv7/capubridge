import { cellToText } from "@/shared/components/data/grid";
import { columnFilter, searchClause, type ColumnFilterOperator } from "./sqliteQuery";

/** One filter shown as a chip: a column, a condition and a value, with the SQL it runs. */
export interface SqliteFilterChip {
  id: string;
  column: string;
  operator: ColumnFilterOperator;
  value?: unknown;
  label: string;
  sql: string;
}

export const FILTER_OPERATORS: ReadonlyArray<{
  value: ColumnFilterOperator;
  label: string;
  needsValue: boolean;
}> = [
  { value: "contains", label: "contains", needsValue: true },
  { value: "=", label: "equals", needsValue: true },
  { value: "!=", label: "does not equal", needsValue: true },
  { value: "starts", label: "starts with", needsValue: true },
  { value: "ends", label: "ends with", needsValue: true },
  { value: ">", label: "greater than", needsValue: true },
  { value: ">=", label: "at least", needsValue: true },
  { value: "<", label: "less than", needsValue: true },
  { value: "<=", label: "at most", needsValue: true },
  { value: "null", label: "is NULL", needsValue: false },
  { value: "not-null", label: "is not NULL", needsValue: false },
];

const SYMBOL: Partial<Record<ColumnFilterOperator, string>> = {
  "=": "=",
  "!=": "≠",
  ">": ">",
  ">=": "≥",
  "<": "<",
  "<=": "≤",
};

function valueWords(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object" && "__type" in value && "value" in value) {
    return typeof value.value === "string" ? value.value : cellToText(value.value);
  }
  return typeof value === "string" ? `“${value}”` : cellToText(value);
}

/** What a chip says: `state = “draft”`, `qty ≥ 3`, `note is NULL`, `name contains “kg”`. */
export function chipLabel(column: string, operator: ColumnFilterOperator, value?: unknown): string {
  if (operator === "null" || operator === "not-null" || value === null || value === undefined) {
    const isNull = operator === "null" || operator === "=";
    return `${column} ${isNull ? "is NULL" : "is not NULL"}`;
  }
  const symbol = SYMBOL[operator];
  if (symbol) return `${column} ${symbol} ${valueWords(value)}`;
  const words = FILTER_OPERATORS.find((entry) => entry.value === operator)?.label ?? operator;
  return `${column} ${words} ${valueWords(value)}`;
}

let counter = 0;

/**
 * A chip for one condition; throws when the value cannot be written as SQL (a BLOB read only in
 * part), so the caller can say why instead of filtering on half a value.
 */
export function makeChip(
  column: string,
  operator: ColumnFilterOperator,
  value?: unknown,
): SqliteFilterChip {
  counter += 1;
  return {
    id: `f${counter}`,
    column,
    operator,
    value,
    label: chipLabel(column, operator, value),
    sql: columnFilter(column, operator, value),
  };
}

/** A chip's SQL text without the parentheses and noise the person never typed. */
function clause(sql: string): string {
  return sql.trim().replace(/;+\s*$/, "");
}

/**
 * Every condition at once: each chip, the free WHERE and the search over every column, joined
 * with AND. Each part keeps its own parentheses, so an OR inside one never leaks into another.
 */
export function combineWhere(
  chips: readonly Pick<SqliteFilterChip, "sql">[],
  where: string,
  searchColumns: readonly string[],
  search: string,
): string {
  const typed = [...chips.map((chip) => clause(chip.sql)), clause(where)].filter(Boolean);
  const searched = searchClause(searchColumns, search);
  const count = typed.length + (searched ? 1 : 0);
  if (count === 0) return "";
  if (count === 1) return typed[0] ?? searched;
  return [...typed.map((part) => `(${part})`), ...(searched ? [searched] : [])].join(" AND ");
}
