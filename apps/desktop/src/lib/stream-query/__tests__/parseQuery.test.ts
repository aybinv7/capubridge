import { describe, expect, it } from "vite-plus/test";
import { parseQuery } from "@/lib/stream-query/parseQuery";

const KEYS = ["tag", "level", "message", "package", "age", "is", "url"];

function shape(source: string) {
  return parseQuery(source, KEYS).terms.map(({ key, value, negate, operator }) => ({
    key,
    value,
    negate,
    operator,
  }));
}

describe("parseQuery", () => {
  it("reads keyed terms with their operators and negation", () => {
    expect(shape("tag:Net -tag:Chatty tag~:^Ok.* tag=:Exact")).toEqual([
      { key: "tag", value: "Net", negate: false, operator: "contains" },
      { key: "tag", value: "Chatty", negate: true, operator: "contains" },
      { key: "tag", value: "^Ok.*", negate: false, operator: "regex" },
      { key: "tag", value: "Exact", negate: false, operator: "exact" },
    ]);
  });

  it("joins adjacent bare words into one phrase and keeps quoted values whole", () => {
    expect(shape('null pointer message:"two words" tail')).toEqual([
      { key: null, value: "null pointer", negate: false, operator: "contains" },
      { key: "message", value: "two words", negate: false, operator: "contains" },
      { key: null, value: "tail", negate: false, operator: "contains" },
    ]);
  });

  it("reads /regex/ and negated words as free text", () => {
    expect(shape("/time(out)? \\d+/ -noise")).toEqual([
      { key: null, value: "time(out)? \\d+", negate: false, operator: "regex" },
      { key: null, value: "noise", negate: true, operator: "contains" },
    ]);
  });

  it("keeps unknown keys and URLs as free text", () => {
    expect(shape("http://host:8080/api")).toEqual([
      { key: null, value: "http://host:8080/api", negate: false, operator: "contains" },
    ]);
  });

  it("records where each term sits so it can be edited in place", () => {
    const { terms } = parseQuery("  level:W  tag:A", KEYS);
    expect(terms.map((term) => [term.start, term.end])).toEqual([
      [2, 9],
      [11, 16],
    ]);
  });

  it("survives unfinished input", () => {
    expect(shape('tag: message:"open')).toEqual([
      { key: "tag", value: "", negate: false, operator: "contains" },
      { key: "message", value: "open", negate: false, operator: "contains" },
    ]);
    expect(shape("/unclosed")).toEqual([
      { key: null, value: "/unclosed", negate: false, operator: "contains" },
    ]);
  });
});
