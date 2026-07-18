import { expect, test } from "vite-plus/test";
import {
  INDEXED_DB_DEFAULT_PAGE_SIZE,
  INDEXED_DB_PROTOCOL_PAGE_LIMIT,
  indexedDbProtocolPageSize,
} from "../idbPaging";

test("caps IndexedDB requests at the protocol limit", () => {
  expect(indexedDbProtocolPageSize(INDEXED_DB_PROTOCOL_PAGE_LIMIT + 1)).toBe(
    INDEXED_DB_PROTOCOL_PAGE_LIMIT,
  );
  expect(indexedDbProtocolPageSize(Number.MAX_SAFE_INTEGER)).toBe(INDEXED_DB_PROTOCOL_PAGE_LIMIT);
});

test("normalizes invalid IndexedDB page sizes", () => {
  expect(indexedDbProtocolPageSize(0)).toBe(1);
  expect(indexedDbProtocolPageSize(-10)).toBe(1);
  expect(indexedDbProtocolPageSize(42.9)).toBe(42);
  expect(indexedDbProtocolPageSize(Number.NaN)).toBe(INDEXED_DB_DEFAULT_PAGE_SIZE);
});
