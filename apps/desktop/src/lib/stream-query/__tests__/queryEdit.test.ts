import { describe, expect, it } from "vite-plus/test";
import { parseQuery } from "@/lib/stream-query/parseQuery";
import { appendTerm, formatTerm, withLevelFloor } from "@/lib/stream-query/queryEdit";
import { applySuggestion, suggestQuery } from "@/lib/stream-query/querySuggest";

const KEYS = ["tag", "level", "package", "is"];
const parse = (source: string) => parseQuery(source, KEYS);

describe("query edits", () => {
  it("quotes values that hold spaces or quotes", () => {
    expect(formatTerm("tag", "My Tag")).toBe('tag:"My Tag"');
    expect(formatTerm("tag", 'a"b', true)).toBe('-tag:"a\\"b"');
    expect(formatTerm("tag", "Net")).toBe("tag:Net");
  });

  it("adds a field filter once and swaps its opposite", () => {
    expect(appendTerm(parse("level:W"), "tag", "Net")).toBe("level:W tag:Net");
    expect(appendTerm(parse("level:W tag:Net"), "tag", "Net")).toBe("level:W tag:Net");
    expect(appendTerm(parse("tag:Net level:W"), "tag", "Net", true)).toBe("level:W -tag:Net");
  });

  it("moves the level floor without touching the rest", () => {
    expect(withLevelFloor(parse("tag:A level:I -level:F"), "E")).toBe("tag:A -level:F level:E");
    expect(withLevelFloor(parse("level:W tag:A"), null)).toBe("tag:A");
  });
});

describe("query suggestions", () => {
  const source = {
    keys: [
      { insert: "tag:", detail: "Tag contains" },
      { insert: "-tag:", detail: "Hide a tag" },
      { insert: "level:", detail: "Level and above" },
    ],
    valuesFor: (key: string, prefix: string) =>
      key === "level"
        ? ["V", "D", "I", "W", "E", "F"]
            .filter((level) => level.toLowerCase().startsWith(prefix.toLowerCase()))
            .map((level) => ({ label: level, insert: level }))
        : key === "tag"
          ? [{ label: "My Tag", insert: "My Tag" }]
          : [],
    recent: ["tag:Net level:E", "is:crash"],
  };

  it("offers earlier queries and keys in an empty field", () => {
    const result = suggestQuery("", 0, source);
    expect(result.items.map((item) => item.label)).toEqual([
      "tag:Net level:E",
      "is:crash",
      "tag:",
      "-tag:",
      "level:",
    ]);
  });

  it("completes the key under the caret, then its values", () => {
    expect(suggestQuery("is:crash le", 11, source).items.map((item) => item.insert)).toEqual([
      "level:",
    ]);
    const first = suggestQuery("-tag:", 5, source).items[0];
    if (!first) throw new Error("expected a tag suggestion");
    expect(first.insert).toBe('-tag:"My Tag" ');
    const applied = applySuggestion("x -tag: y", { from: 2, to: 7 }, first);
    expect(applied.text).toBe('x -tag:"My Tag"  y');
    expect(applied.caret).toBe(16);
  });
});
