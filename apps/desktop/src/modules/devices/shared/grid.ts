/** How many tiles of `tileWidth` fit across `width` pixels, never fewer than one. */
export function columnsFor(width: number, tileWidth: number): number {
  return Math.max(1, Math.floor(width / Math.max(1, tileWidth)));
}

/** Splits items into rows of `columns`, for a virtualised grid. */
export function chunkRows<T>(items: readonly T[], columns: number): T[][] {
  const size = Math.max(1, columns);
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

/**
 * The scroll position that brings row `index` fully into a viewport, or the current one when it
 * is already visible. Rows have a fixed `rowHeight`; `offset` is any header above the first row.
 */
export function scrollTopToReveal(
  index: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  offset = 0,
): number {
  const top = offset + index * rowHeight;
  const bottom = top + rowHeight;
  if (top < scrollTop + offset) return Math.max(0, top - offset);
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight;
  return scrollTop;
}
