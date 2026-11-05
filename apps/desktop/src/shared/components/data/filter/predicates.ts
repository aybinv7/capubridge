import { cellToText } from "../grid/valueFormat";
import type { GridColumnType } from "../grid/types";

export type PredicateOperator =
  | "contains"
  | "equals"
  | "notEquals"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "isNull"
  | "isNotNull"
  | "isTrue"
  | "isFalse"
  | "isEmpty"
  | "isNotEmpty";

/** What the value field of a condition asks for. */
export type PredicateValueKind = "text" | "number" | "date" | "none";

export type PredicateJoin = "and" | "or";

/** One condition on one column. `value` is what was typed; it is read by the column's type. */
export interface DataPredicate {
  id: string;
  columnId: string;
  operator: PredicateOperator;
  value: string;
}

export interface PredicateOperatorInfo {
  id: PredicateOperator;
  label: string;
  takesValue: boolean;
}

export const OPERATORS: readonly PredicateOperatorInfo[] = [
  { id: "contains", label: "contains", takesValue: true },
  { id: "equals", label: "is", takesValue: true },
  { id: "notEquals", label: "is not", takesValue: true },
  { id: "startsWith", label: "starts with", takesValue: true },
  { id: "endsWith", label: "ends with", takesValue: true },
  { id: "gt", label: "is after / more than", takesValue: true },
  { id: "gte", label: "is from / at least", takesValue: true },
  { id: "lt", label: "is before / less than", takesValue: true },
  { id: "lte", label: "is until / at most", takesValue: true },
  { id: "isNull", label: "is empty (null)", takesValue: false },
  { id: "isNotNull", label: "has a value", takesValue: false },
  { id: "isTrue", label: "is true", takesValue: false },
  { id: "isFalse", label: "is false", takesValue: false },
  { id: "isEmpty", label: "is blank", takesValue: false },
  { id: "isNotEmpty", label: "is not blank", takesValue: false },
];

const BY_ID = new Map(OPERATORS.map((operator) => [operator.id, operator]));
const ORDERING = new Set<PredicateOperator>(["gt", "gte", "lt", "lte"]);
const TEXTUAL = new Set<PredicateOperator>(["contains", "startsWith", "endsWith"]);
const DATE_TEXT = /^\d{4}-\d{2}-\d{2}([T ].*)?$/;

export function operatorInfo(id: PredicateOperator): PredicateOperatorInfo {
  return BY_ID.get(id) ?? { id, label: id, takesValue: true };
}

/** Operators that make sense for a column of this type. */
export function operatorsFor(type?: GridColumnType): PredicateOperator[] {
  switch (type) {
    case "integer":
    case "real":
      return ["equals", "notEquals", "gt", "gte", "lt", "lte", "isNull", "isNotNull"];
    case "date":
      return ["equals", "gt", "gte", "lt", "lte", "isNull", "isNotNull"];
    case "boolean":
      return ["isTrue", "isFalse", "isNull", "isNotNull"];
    case "json":
      return ["contains", "isNull", "isNotNull", "isEmpty", "isNotEmpty"];
    default:
      return OPERATORS.map((operator) => operator.id).filter(
        (id) => id !== "isTrue" && id !== "isFalse",
      );
  }
}

/** The value editor a condition needs: a date for dates, a number for numbers, text otherwise. */
export function valueKindFor(type: GridColumnType | undefined, operator: PredicateOperator) {
  if (!operatorInfo(operator).takesValue) return "none" satisfies PredicateValueKind;
  if (TEXTUAL.has(operator)) return "text" satisfies PredicateValueKind;
  if (type === "date") return "date" satisfies PredicateValueKind;
  if (type === "integer" || type === "real") return "number" satisfies PredicateValueKind;
  return "text" satisfies PredicateValueKind;
}

function markerOf(value: unknown): { __type: string; value?: unknown } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const type = (value as { __type?: unknown }).__type;
  return typeof type === "string" ? (value as { __type: string; value?: unknown }) : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asTime(value: unknown, type?: GridColumnType): number | null {
  const marker = markerOf(value);
  if (marker?.__type === "Date") return asTime(marker.value);
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && type === "date") {
    return Math.abs(value) < 1e11 ? value * 1000 : value;
  }
  if (typeof value === "string" && DATE_TEXT.test(value)) {
    const time = Date.parse(value.length === 10 ? `${value}T00:00:00` : value);
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object" && !markerOf(value)) return Object.keys(value).length === 0;
  return false;
}

function compare(left: number, right: number, operator: PredicateOperator): boolean {
  switch (operator) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "equals":
      return left === right;
    case "notEquals":
      return left !== right;
    default:
      return false;
  }
}

function sameLocalDay(time: number, dateText: string): boolean {
  const date = new Date(time);
  const day = `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return day === dateText;
}

/** Whether one cell meets one condition. Numbers and dates compare as such, text ignores case. */
export function matchesPredicate(
  cell: unknown,
  predicate: DataPredicate,
  type?: GridColumnType,
): boolean {
  const { operator, value } = predicate;
  switch (operator) {
    case "isNull":
      return cell === null || cell === undefined || markerOf(cell)?.__type === "Undefined";
    case "isNotNull":
      return !(cell === null || cell === undefined || markerOf(cell)?.__type === "Undefined");
    case "isTrue":
      return cell === true || cell === 1;
    case "isFalse":
      return cell === false || cell === 0;
    case "isEmpty":
      return isBlank(cell);
    case "isNotEmpty":
      return !isBlank(cell);
    default:
      break;
  }
  if (cell === null || cell === undefined) return operator === "notEquals" && value !== "";
  const time = asTime(cell, type);
  if (time !== null && (type === "date" || DATE_TEXT.test(value))) {
    if (DATE_TEXT.test(value) && value.length === 10 && operator === "equals") {
      return sameLocalDay(time, value);
    }
    const wanted = asTime(value.length === 10 ? `${value}T00:00:00` : value);
    if (wanted !== null) return compare(time, wanted, operator);
  }
  const number = asNumber(cell);
  const wantedNumber = asNumber(value);
  if (number !== null && wantedNumber !== null && !TEXTUAL.has(operator)) {
    return compare(number, wantedNumber, operator);
  }
  const text = cellToText(cell).toLowerCase();
  const needle = value.toLowerCase();
  switch (operator) {
    case "contains":
      return text.includes(needle);
    case "startsWith":
      return text.startsWith(needle);
    case "endsWith":
      return text.endsWith(needle);
    case "equals":
      return text === needle;
    case "notEquals":
      return text !== needle;
    default:
      return ORDERING.has(operator) ? compare(text.localeCompare(needle), 0, operator) : false;
  }
}

/** A condition counts only when it is complete: an operator that needs a value has one. */
export function isComplete(predicate: DataPredicate): boolean {
  return !operatorInfo(predicate.operator).takesValue || predicate.value.trim() !== "";
}

/** Whether a row meets the conditions, joined by AND or OR. Incomplete conditions are skipped. */
export function matchesAll(
  cells: Readonly<Record<string, unknown>>,
  predicates: readonly DataPredicate[],
  join: PredicateJoin,
  types: Readonly<Record<string, GridColumnType | undefined>>,
): boolean {
  const active = predicates.filter(isComplete);
  if (active.length === 0) return true;
  const test = (predicate: DataPredicate) =>
    matchesPredicate(cells[predicate.columnId], predicate, types[predicate.columnId]);
  return join === "and" ? active.every(test) : active.some(test);
}

/** One line for a condition, e.g. `total is at least 10`. */
export function describePredicate(predicate: DataPredicate, columnTitle: string): string {
  const info = operatorInfo(predicate.operator);
  return info.takesValue
    ? `${columnTitle} ${info.label} ${predicate.value}`
    : `${columnTitle} ${info.label}`;
}
