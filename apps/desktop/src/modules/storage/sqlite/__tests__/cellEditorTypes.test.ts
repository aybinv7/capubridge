import { expect, test } from "vite-plus/test";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import {
  detectEditorKind,
  detectDateEncoding,
  toDateInputValue,
  fromDateInputValue,
  toBooleanValue,
  fromBooleanValue,
  parseEditorValue,
} from "../cellEditorTypes";

function column(name: string, colType: string): SqliteColumnInfo {
  return { cid: 0, name, colType, notnull: false, defaultValue: null, pk: 0 };
}

// ─── Detection ───────────────────────────────────────────────────────────────

test("detects numbers from the declared type", () => {
  expect(detectEditorKind(column("qty", "INTEGER"), 5)).toBe("number");
  expect(detectEditorKind(column("price", "REAL"), 1.5)).toBe("number");
});

test("detects a boolean only when a 0/1 integer is named like a flag", () => {
  expect(detectEditorKind(column("is_active", "INTEGER"), 1)).toBe("boolean");
  expect(detectEditorKind(column("sync_enabled", "INTEGER"), 0)).toBe("boolean");
  // Same 0/1 value, but nothing about the name says boolean.
  expect(detectEditorKind(column("quantity", "INTEGER"), 1)).toBe("number");
});

test("detects dates from ISO text", () => {
  expect(detectEditorKind(column("created_at", "TEXT"), "2026-08-07T09:24:00Z")).toBe("date");
  expect(detectEditorKind(column("due_date", "TEXT"), "2026-08-07")).toBe("date");
});

test("detects JSON payloads stored as text", () => {
  expect(detectEditorKind(column("payload", "TEXT"), '{"a":1}')).toBe("json");
  expect(detectEditorKind(column("label", "TEXT"), "hello")).toBe("text");
});

test("a text column that merely looks numeric stays text", () => {
  expect(detectEditorKind(column("code", "TEXT"), "007")).toBe("text");
  expect(parseEditorValue("text", "007")).toBe("007");
});

// ─── Date round-tripping ─────────────────────────────────────────────────────

test("recognises the storage encoding", () => {
  expect(detectDateEncoding("2026-08-07")).toBe("date-only");
  expect(detectDateEncoding("2026-08-07T09:24:00Z")).toBe("iso");
  expect(detectDateEncoding(1786137840)).toBe("epoch-seconds");
  expect(detectDateEncoding(1786137840000)).toBe("epoch-millis");
  expect(detectDateEncoding("not a date")).toBe(null);
});

test("writes a date back in the encoding the column already used", () => {
  expect(fromDateInputValue("2026-09-01", "2026-08-07")).toBe("2026-09-01");
  expect(typeof fromDateInputValue("2026-09-01", 1786137840)).toBe("number");
  expect(typeof fromDateInputValue("2026-09-01", "2026-08-07T09:24:00Z")).toBe("string");
});

test("changing the day keeps the time of day", () => {
  const next = fromDateInputValue("2026-09-01", "2026-08-07T09:24:35Z");
  expect(next).toBe("2026-09-01T09:24:35Z");
});

test("epoch seconds stay seconds, not millis", () => {
  const original = 1786137840; // seconds
  const next = fromDateInputValue("2026-09-01", original) as number;
  expect(next).toBeLessThan(1e11);
  expect(toDateInputValue(next)).toBe("2026-09-01");
});

test("a date survives a display/edit round trip unchanged", () => {
  for (const original of ["2026-08-07", "2026-08-07T09:24:35Z", 1786137840, 1786137840000]) {
    const shown = toDateInputValue(original);
    expect(fromDateInputValue(shown, original)).toEqual(original);
  }
});

// ─── Boolean round-tripping ──────────────────────────────────────────────────

test("reads the usual boolean encodings", () => {
  expect(toBooleanValue(1)).toBe(true);
  expect(toBooleanValue(0)).toBe(false);
  expect(toBooleanValue("1")).toBe(true);
  expect(toBooleanValue("true")).toBe(true);
  expect(toBooleanValue("false")).toBe(false);
});

test("writes a boolean back in the shape the column used", () => {
  expect(fromBooleanValue(true, 0)).toBe(1);
  expect(fromBooleanValue(false, 1)).toBe(0);
  expect(fromBooleanValue(true, "false")).toBe("true");
  expect(fromBooleanValue(true, "0")).toBe("1");
});

// ─── Null handling ───────────────────────────────────────────────────────────

test("an emptied cell becomes NULL rather than an empty string", () => {
  expect(parseEditorValue("text", "")).toBe(null);
  expect(parseEditorValue("number", "")).toBe(null);
  expect(fromDateInputValue("", "2026-08-07")).toBe(null);
});

test("an unparseable number is kept verbatim instead of becoming NaN", () => {
  expect(parseEditorValue("number", "abc")).toBe("abc");
});
