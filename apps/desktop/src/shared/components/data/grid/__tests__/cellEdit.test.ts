import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import {
  applyLocalDate,
  editorKindFor,
  editorText,
  inlineEditRefusal,
  lineBreakStyle,
  parseCellEdit,
  toLocalDateInput,
} from "../editors/cellEdit";

const previousZone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "Africa/Algiers";
});

afterAll(() => {
  if (previousZone === undefined) delete process.env.TZ;
  else process.env.TZ = previousZone;
});

describe("an empty cell edits as its column, not as text (S5)", () => {
  test("the editor follows the other values of the column", () => {
    expect(editorKindFor(null, undefined, 5)).toBe("number");
    expect(editorKindFor(undefined, undefined, false)).toBe("boolean");
    expect(editorKindFor(null, undefined, "2024-01-01")).toBe("date");
    expect(
      editorKindFor(null, undefined, { __type: "Date", value: "2024-01-01T00:00:00.000Z" }),
    ).toBe("date");
    expect(editorKindFor(null, "date", 1_700_000_000_000)).toBe("date");
    expect(editorKindFor(null, undefined, { a: 1 })).toBeNull();
    expect(editorKindFor(null)).toBe("text");
  });

  test("what is typed is stored with the column's type", () => {
    expect(parseCellEdit(null, "number", "7", 5)).toEqual({ ok: true, value: 7, changed: true });
    expect(parseCellEdit(null, "boolean", "true", false)).toEqual({
      ok: true,
      value: true,
      changed: true,
    });
    expect(parseCellEdit(null, "number", "", 5)).toEqual({ ok: true, value: null, changed: false });
    expect(parseCellEdit(undefined, "date", "", "2024-01-01")).toEqual({
      ok: true,
      value: undefined,
      changed: false,
    });
  });

  test("a picked date takes the form of the column's dates", () => {
    expect(
      parseCellEdit(null, "date", "2024-03-12", {
        __type: "Date",
        value: "2024-01-01T00:00:00.000Z",
      }),
    ).toEqual({
      ok: true,
      value: { __type: "Date", value: "2024-03-11T23:00:00.000Z" },
      changed: true,
    });
    expect(parseCellEdit(null, "date", "2024-03-12", 1_700_000_000_000)).toEqual({
      ok: true,
      value: new Date(2024, 2, 12).getTime(),
      changed: true,
    });
    expect(parseCellEdit(null, "date", "2024-03-12", 1_700_000_000)).toEqual({
      ok: true,
      value: new Date(2024, 2, 12).getTime() / 1000,
      changed: true,
    });
    expect(parseCellEdit(null, "date", "2024-03-12", "2024-01-01")).toEqual({
      ok: true,
      value: "2024-03-12",
      changed: true,
    });
  });
});

describe("dates in a UTC+1 time zone (Algeria)", () => {
  test("the zone really is UTC+1 for these tests", () => {
    expect(new Date("2024-03-10T00:30:00.000Z").getTimezoneOffset()).toBe(-60);
  });

  test("a picked calendar date is written as that date, not the day before", () => {
    expect(applyLocalDate("2024-03-10", "2024-03-12")).toBe("2024-03-12");
    expect(parseCellEdit("2024-03-10", "date", "2024-03-12")).toEqual({
      ok: true,
      value: "2024-03-12",
      changed: true,
    });
  });

  test("an instant stored in UTC shows on the local day it falls on", () => {
    expect(toLocalDateInput("2024-03-10T23:30:00.000Z")).toBe("2024-03-11");
    expect(toLocalDateInput("2024-03-10T22:00:00Z")).toBe("2024-03-10");
  });

  test("moving an instant keeps its local time of day and its text format", () => {
    expect(applyLocalDate("2024-03-10T23:30:00.000Z", "2024-03-12")).toBe(
      "2024-03-11T23:30:00.000Z",
    );
    expect(applyLocalDate("2024-03-10T08:15:00Z", "2024-04-01")).toBe("2024-04-01T08:15:00Z");
    expect(applyLocalDate("2024-03-10T09:15:00+01:00", "2024-03-11")).toBe(
      "2024-03-11T09:15:00+01:00",
    );
  });

  test("a date and time without a zone only changes its date part", () => {
    expect(applyLocalDate("2024-03-10T00:30:00", "2024-03-12")).toBe("2024-03-12T00:30:00");
  });

  test("epoch values keep their unit", () => {
    const ms = Date.UTC(2024, 2, 10, 23, 30);
    expect(toLocalDateInput(ms)).toBe("2024-03-11");
    expect(applyLocalDate(ms, "2024-03-12")).toBe(Date.UTC(2024, 2, 11, 23, 30));
    expect(applyLocalDate(ms / 1000, "2024-03-12")).toBe(Date.UTC(2024, 2, 11, 23, 30) / 1000);
  });

  test("picking the same day writes nothing", () => {
    expect(parseCellEdit("2024-03-10T23:30:00.000Z", "date", "2024-03-11")).toEqual({
      ok: true,
      value: "2024-03-10T23:30:00.000Z",
      changed: false,
    });
  });
});

describe("parseCellEdit keeps the stored type", () => {
  test("text that looks like a number, a boolean or null stays text", () => {
    for (const text of ["123", "true", "null"]) {
      expect(parseCellEdit("abc", "text", text)).toEqual({ ok: true, value: text, changed: true });
    }
  });

  test("an unchanged value is not a change", () => {
    expect(parseCellEdit("abc", "text", "abc").ok && parseCellEdit("abc", "text", "abc")).toEqual({
      ok: true,
      value: "abc",
      changed: false,
    });
    expect(parseCellEdit(4, "number", "4")).toEqual({ ok: true, value: 4, changed: false });
    expect(parseCellEdit(null, "text", "")).toEqual({ ok: true, value: null, changed: false });
  });

  test("numbers are checked instead of written as text", () => {
    expect(parseCellEdit(4, "number", "4.5")).toEqual({ ok: true, value: 4.5, changed: true });
    expect(parseCellEdit(4, "number", "four")).toEqual({
      ok: false,
      error: '"four" is not a number',
    });
  });

  test("the editor is picked from the value, not the field name", () => {
    expect(editorKindFor(1_700_000_000)).toBe("number");
    expect(editorKindFor(1_700_000_000, "date")).toBe("date");
    expect(editorKindFor("2024-01-01")).toBe("date");
    expect(editorKindFor("created")).toBe("text");
    expect(editorKindFor(true)).toBe("boolean");
    expect(editorKindFor({ a: 1 })).toBeNull();
    expect(editorKindFor({ __type: "Date", value: "2024-01-01T00:00:00.000Z" })).toBeNull();
  });
});

describe("text with line breaks (S1)", () => {
  test("opens the multi-line editor, and long text too", () => {
    expect(editorKindFor("a\r\nb")).toBe("multiline");
    expect(editorKindFor("a\nb")).toBe("multiline");
    expect(editorKindFor("x".repeat(201))).toBe("multiline");
    expect(editorKindFor("plain")).toBe("text");
  });

  test("an edit of one other character keeps CRLF, LF and CR line breaks", () => {
    for (const original of ["one\r\ntwo", "one\ntwo", "one\rtwo"]) {
      const shown = editorText(original, "multiline");
      expect(shown).toBe("one\ntwo");
      expect(parseCellEdit(original, "multiline", `${shown}!`)).toEqual({
        ok: true,
        value: `${original}!`,
        changed: true,
      });
    }
  });

  test("text that mixes two kinds of line break is not edited inline", () => {
    expect(lineBreakStyle("a\r\nb\nc")).toBe("mixed");
    expect(inlineEditRefusal("a\r\nb\nc")).toMatch(/two kinds of line break/);
    expect(inlineEditRefusal("a\r\nb")).toBeNull();
  });
});

describe("a typed integer past 2^53 (S4)", () => {
  test("is refused where it cannot be kept exactly, never rounded", () => {
    const parsed = parseCellEdit(1, "number", "9007199254740993");
    expect(parsed.ok).toBe(false);
    expect(parseCellEdit(1, "number", "9007199254740991")).toEqual({
      ok: true,
      value: 9007199254740991,
      changed: true,
    });
  });
});
