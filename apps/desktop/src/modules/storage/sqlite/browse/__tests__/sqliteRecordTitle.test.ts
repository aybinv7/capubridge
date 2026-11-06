import { describe, expect, test } from "vite-plus/test";
import { recordKeyLabel, recordStateWords } from "../sqliteRecordTitle";

describe("record title", () => {
  test("a row is named by its key, a composite key in declared order", () => {
    expect(recordKeyLabel(["id"], { id: 4182, name: "x" })).toBe("id 4182");
    expect(recordKeyLabel(["order_id", "line"], { line: 3, order_id: 12 })).toBe(
      "order_id 12 · line 3",
    );
  });

  test("a NULL key and a wide integer key read as they are stored", () => {
    expect(recordKeyLabel(["code"], { code: null })).toBe("code NULL");
    expect(recordKeyLabel(["id"], { id: { __type: "Number", value: "9007199254740993" } })).toBe(
      "id 9007199254740993",
    );
  });

  test("a table with no key leaves the row number to name it", () => {
    expect(recordKeyLabel([], { a: 1 })).toBeNull();
  });
});

describe("record state words", () => {
  test("a change seen names who made it and when", () => {
    expect(recordStateWords("recent", { source: "external", seen: "01:10:22" })).toBe(
      "changed by the app · seen 01:10:22",
    );
    expect(recordStateWords(undefined, { source: "capubridge", seen: "01:11:00" })).toBe(
      "changed here · 01:11:00",
    );
  });

  test("a staged row says what will happen to it", () => {
    expect(recordStateWords("staged-delete", null)).toBe("will be deleted");
    expect(recordStateWords(undefined, null)).toBeNull();
  });
});
