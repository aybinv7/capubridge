import { describe, expect, test } from "vite-plus/test";
import { ROOT_ID, expandedToDepth, jsonPreview, jsonRows } from "../jsonTree";

const doc = { user: { name: "Ada", tags: ["a", "b"] }, ok: true, none: null, "a/b": 1 };

describe("jsonTree", () => {
  test("shows only the root while nothing is open", () => {
    const rows = jsonRows(doc, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: ROOT_ID, preview: "{ 4 keys }", expandable: true });
  });

  test("lists children depth first in key order", () => {
    const rows = jsonRows(doc, new Set([ROOT_ID, "$/user"]));
    expect(rows.map((row) => [row.depth, row.key])).toEqual([
      [0, null],
      [1, "user"],
      [2, "name"],
      [2, "tags"],
      [1, "ok"],
      [1, "none"],
      [1, "a/b"],
    ]);
    expect(rows.find((row) => row.key === "a/b")?.id).toBe("$/a~1b");
  });

  test("opens containers down to a depth", () => {
    expect(expandedToDepth(doc, 1)).toEqual(new Set([ROOT_ID]));
    expect(expandedToDepth(doc, 2)).toEqual(new Set([ROOT_ID, "$/user"]));
    expect(expandedToDepth(doc, 3)).toEqual(new Set([ROOT_ID, "$/user", "$/user/tags"]));
  });

  test("previews values the way they read", () => {
    expect(jsonPreview("hi")).toBe('"hi"');
    expect(jsonPreview([1])).toBe("[ 1 item ]");
    expect(jsonPreview({})).toBe("{ 0 keys }");
    expect(jsonPreview(null)).toBe("null");
    expect(jsonPreview("x".repeat(500)).length).toBeLessThan(260);
  });

  test("does not offer to open empty containers", () => {
    expect(jsonRows({ empty: [] }, new Set([ROOT_ID]))[1]?.expandable).toBe(false);
  });
});
