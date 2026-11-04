import type { GridColumn, GridRow } from "./types";
import { formatCell } from "./valueFormat";

export const MIN_COLUMN_WIDTH = 56;
export const MAX_COLUMN_WIDTH = 360;
const CELL_PADDING = 20;
/** Header padding, type glyph, sort arrow and the column-menu button around the title. */
const HEADER_CHROME = 64;
const SAMPLE_ROWS = 200;

/**
 * Columns fit 90 % of their sampled values; the rare long outlier truncates instead
 * of widening the column for everyone (the inspector shows it in full).
 */
const CONTENT_PERCENTILE = 0.9;

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(fraction * (ordered.length - 1))] ?? 0;
}

/** Width of a string in px. The default assumes 12 px IBM Plex Mono (≈7.2 px per glyph). */
export type TextMeasure = (text: string) => number;

export const estimateMonoWidth: TextMeasure = (text) => Math.ceil(text.length * 7.2);

/**
 * Content-aware column widths: the widest of the header and a sample of rows,
 * clamped. Replaces fixed 200 px columns that `table-layout: fixed` stretched.
 */
export function measureColumnWidths(
  columns: readonly GridColumn[],
  rows: readonly GridRow[],
  measure: TextMeasure = estimateMonoWidth,
): Record<string, number> {
  const sample = rows.length > SAMPLE_ROWS ? rows.slice(0, SAMPLE_ROWS) : rows;
  const widths: Record<string, number> = {};
  for (const column of columns) {
    if (column.width !== undefined) {
      widths[column.id] = column.width;
      continue;
    }
    const header = measure(column.title) + HEADER_CHROME;
    const cells = sample.map((row) => {
      const cell = formatCell(row.cells[column.id], column.type);
      const badge = cell.badge ? measure(cell.badge) + 6 : 0;
      return Math.min(MAX_COLUMN_WIDTH, measure(cell.text) + badge + CELL_PADDING);
    });
    const typical = percentile(cells, CONTENT_PERCENTILE);
    widths[column.id] = Math.min(
      MAX_COLUMN_WIDTH,
      Math.max(MIN_COLUMN_WIDTH, Math.ceil(Math.max(header, typical))),
    );
  }
  return widths;
}

/** Canvas-backed measure for the real grid font, falling back to the estimate. */
export function createCanvasMeasure(font: string): TextMeasure {
  if (typeof document === "undefined") return estimateMonoWidth;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return estimateMonoWidth;
  context.font = font;
  return (text) => Math.ceil(context.measureText(text).width);
}

/**
 * Grows columns to fill the viewport when their natural widths leave space, like a
 * full-width table. Extra space is shared in proportion to each column's width and
 * only among `fillable` columns (never ones the user resized).
 */
export function fillToWidth(
  widths: Readonly<Record<string, number>>,
  order: readonly string[],
  fillable: ReadonlySet<string>,
  available: number,
): Record<string, number> {
  const total = order.reduce((sum, id) => sum + (widths[id] ?? 0), 0);
  const growable = order.filter((id) => fillable.has(id));
  const growableTotal = growable.reduce((sum, id) => sum + (widths[id] ?? 0), 0);
  const extra = Math.floor(available - total);
  if (extra <= 0 || growableTotal <= 0) return { ...widths };
  const next: Record<string, number> = { ...widths };
  let given = 0;
  growable.forEach((id, index) => {
    const share =
      index === growable.length - 1
        ? extra - given
        : Math.floor((extra * (widths[id] ?? 0)) / growableTotal);
    next[id] = (widths[id] ?? 0) + share;
    given += share;
  });
  return next;
}
