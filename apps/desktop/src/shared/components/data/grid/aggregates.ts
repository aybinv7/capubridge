export interface SelectionAggregate {
  /** Cells in the selection. */
  count: number;
  /** Cells that are NULL / empty. */
  nulls: number;
  /** Present only when at least one cell is numeric. */
  numeric?: {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Status-bar summary of the selected cells (count, nulls, and sum/avg/min/max of numbers). */
export function aggregateValues(values: Iterable<unknown>): SelectionAggregate {
  let count = 0;
  let nulls = 0;
  let numericCount = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    count += 1;
    if (value === null || value === undefined || value === "") {
      nulls += 1;
      continue;
    }
    const number = toNumber(value);
    if (number === null) continue;
    numericCount += 1;
    sum += number;
    if (number < min) min = number;
    if (number > max) max = number;
  }
  if (numericCount === 0) return { count, nulls };
  return {
    count,
    nulls,
    numeric: { count: numericCount, sum, avg: sum / numericCount, min, max },
  };
}

/** Compact number for the status bar: integers stay exact, others get 4 significant digits. */
export function formatAggregate(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return Number(value.toPrecision(4)).toLocaleString("en-US", { maximumFractionDigits: 4 });
}
