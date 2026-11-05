import { describe, expect, test } from "vite-plus/test";
import { findMatches, matchCountLabel, matchesByLine, stepMatch } from "../textFind";
import { lineSegments } from "../textSegments";

const lower = (lines: string[]) => lines.map((line) => line.toLowerCase());

describe("findMatches", () => {
  test("finds every case-insensitive, non-overlapping match", () => {
    const matches = findMatches(lower(["Error here", "no", "error ERROR"]), "error");
    expect(matches).toEqual([
      { line: 0, start: 0, end: 5 },
      { line: 2, start: 0, end: 5 },
      { line: 2, start: 6, end: 11 },
    ]);
    expect(findMatches(lower(["aaaa"]), "aa")).toHaveLength(2);
  });

  test("stops at the limit and finds nothing for an empty query", () => {
    expect(findMatches(lower(["x x x x"]), "x", 3)).toHaveLength(3);
    expect(findMatches(lower(["x"]), "")).toEqual([]);
  });

  test("groups matches by line", () => {
    const byLine = matchesByLine(findMatches(lower(["a a", "b", "a"]), "a"));
    expect(byLine.get(0)).toEqual([0, 1]);
    expect(byLine.get(1)).toBeUndefined();
    expect(byLine.get(2)).toEqual([2]);
  });

  test("steps around both ends", () => {
    expect(stepMatch(2, 3, 1)).toBe(0);
    expect(stepMatch(0, 3, -1)).toBe(2);
    expect(stepMatch(-1, 3, -1)).toBe(2);
    expect(stepMatch(0, 0, 1)).toBe(-1);
  });

  test("labels the count", () => {
    expect(matchCountLabel(-1, 0)).toBe("No matches");
    expect(matchCountLabel(2, 41)).toBe("3 of 41");
    expect(matchCountLabel(0, 10_000)).toBe("1 of 10,000+");
  });
});

describe("lineSegments", () => {
  test("is the plain line without tokens or marks", () => {
    expect(lineSegments("abc", undefined, [])).toEqual([{ text: "abc" }]);
  });

  test("cuts coloured runs at match boundaries and keeps their colour", () => {
    const tokens = [
      { text: '"key"', color: "red" },
      { text: ": 1", color: "blue" },
    ];
    const segments = lineSegments('"key": 1', tokens, [{ start: 3, end: 7, current: true }]);
    expect(segments).toEqual([
      { text: '"ke', color: "red", italic: undefined },
      { text: 'y"', color: "red", italic: undefined, mark: "current" },
      { text: ": ", color: "blue", italic: undefined, mark: "current" },
      { text: "1", color: "blue", italic: undefined },
    ]);
    expect(segments.map((segment) => segment.text).join("")).toBe('"key": 1');
  });

  test("marks several ranges on one run", () => {
    const segments = lineSegments("a-a-a", undefined, [
      { start: 0, end: 1, current: false },
      { start: 4, end: 5, current: false },
    ]);
    expect(segments.map((segment) => [segment.text, segment.mark])).toEqual([
      ["a", "hit"],
      ["-a-", undefined],
      ["a", "hit"],
    ]);
  });
});
