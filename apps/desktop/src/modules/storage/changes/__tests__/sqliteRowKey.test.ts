import { expect, test } from "vite-plus/test";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import {
  buildRowKey,
  buildRowKeyFromNames,
  orderKeyColumns,
  pickKeyColumnNames,
} from "../sqliteRowKey";

function column(cid: number, name: string, pk = 0): SqliteColumnInfo {
  return { cid, name, colType: "TEXT", notnull: false, defaultValue: null, pk };
}

test("orders composite keys by primary-key position, not column position", () => {
  // PRIMARY KEY (b, a): "b" is declared first even though "a" comes first in
  // the table. Keying by column order here would silently produce a key the
  // snapshot differ never generates.
  const columns = [column(0, "a", 2), column(1, "b", 1), column(2, "payload")];

  expect(pickKeyColumnNames(columns)).toEqual(["b", "a"]);
  expect(buildRowKey(columns, { a: "A", b: "B", payload: "x" })).toBe('["B","A"]');
});

test("keeps every column of a composite key", () => {
  // A flag-shaped `pk` would drop the second column entirely.
  const columns = [column(0, "tenant", 1), column(1, "id", 2)];
  expect(orderKeyColumns(columns).map((c) => c.name)).toEqual(["tenant", "id"]);
});

test("ignores non-key columns", () => {
  const columns = [column(0, "id", 1), column(1, "name"), column(2, "email")];
  expect(buildRowKey(columns, { id: 7, name: "n", email: "e" })).toBe("[7]");
});

test("returns an empty key when the table has no primary key", () => {
  const columns = [column(0, "a"), column(1, "b")];
  expect(pickKeyColumnNames(columns)).toEqual([]);
  expect(buildRowKey(columns, { a: 1, b: 2 })).toBe("");
});

test("treats a missing column as null so both sides agree", () => {
  expect(buildRowKeyFromNames(["id"], {})).toBe("[null]");
  expect(buildRowKeyFromNames(["id"], { id: null })).toBe("[null]");
});

test("produces the key the snapshot differ builds for the same row", () => {
  // The differ reads PRAGMA table_info and sorts by the pk ordinal, then calls
  // buildRowKeyFromNames with those names. Mirror that here so the two stay
  // pinned together.
  const record = { region: "eu", id: 42, label: "x" };
  const differKey = buildRowKeyFromNames(["region", "id"], record);
  const overlayKey = buildRowKey(
    [column(0, "id", 2), column(1, "region", 1), column(2, "label")],
    record,
  );
  expect(overlayKey).toBe(differKey);
});
