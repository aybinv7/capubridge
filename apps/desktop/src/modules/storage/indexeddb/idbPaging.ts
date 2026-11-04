export const INDEXED_DB_PROTOCOL_PAGE_LIMIT = 10_000;
export const INDEXED_DB_DEFAULT_PAGE_SIZE = 50;

export function indexedDbProtocolPageSize(value: number): number {
  if (!Number.isFinite(value)) return INDEXED_DB_DEFAULT_PAGE_SIZE;
  return Math.min(INDEXED_DB_PROTOCOL_PAGE_LIMIT, Math.max(1, Math.floor(value)));
}

/** Global record offset for a row index inside the current page (detail navigation crosses pages). */
export function globalRecordOffset(page: number, pageSize: number, rowIndex: number): number {
  return (
    Math.max(0, Math.floor(page)) * indexedDbProtocolPageSize(pageSize) + Math.max(0, rowIndex)
  );
}
