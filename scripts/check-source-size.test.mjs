import { describe, expect, test } from "vite-plus/test";
import {
  SOURCE_LINE_LIMIT,
  countPhysicalLines,
  evaluateSourceSizeBoundary,
} from "./check-source-size.mjs";

function baseline(exceptions) {
  return { threshold: SOURCE_LINE_LIMIT, exceptions };
}

function exception(path, maxLines = SOURCE_LINE_LIMIT + 20) {
  return {
    path,
    maxLines,
    owner: "Test owner",
    rationale: "Reviewed exception pending a responsibility split.",
  };
}

describe("source-size boundary", () => {
  test("counts physical lines across newline styles", () => {
    expect(countPhysicalLines("")).toBe(0);
    expect(countPhysicalLines("one\ntwo\n")).toBe(2);
    expect(countPhysicalLines("one\r\ntwo")).toBe(2);
  });

  test("accepts reviewed files within approved maximum", () => {
    const path = "apps/example/src/large.ts";
    const errors = evaluateSourceSizeBoundary(
      [{ path, lines: SOURCE_LINE_LIMIT + 10 }],
      baseline([exception(path)]),
    );

    expect(errors).toEqual([]);
  });

  test("rejects new oversized source and unapproved growth", () => {
    const approvedPath = "apps/example/src/approved.ts";
    const errors = evaluateSourceSizeBoundary(
      [
        { path: approvedPath, lines: SOURCE_LINE_LIMIT + 21 },
        { path: "apps/example/src/new.ts", lines: SOURCE_LINE_LIMIT + 1 },
      ],
      baseline([exception(approvedPath)]),
    );

    expect(errors).toContainEqual(expect.stringContaining("Unapproved source growth"));
    expect(errors).toContainEqual(expect.stringContaining("New oversized source"));
  });

  test("rejects stale, resolved, and undocumented exceptions", () => {
    const resolvedPath = "apps/example/src/resolved.ts";
    const undocumented = exception(resolvedPath);
    undocumented.owner = "";
    undocumented.rationale = "short";
    const errors = evaluateSourceSizeBoundary(
      [{ path: resolvedPath, lines: SOURCE_LINE_LIMIT }],
      baseline([undocumented, exception("apps/example/src/missing.ts")]),
    );

    expect(errors).toContainEqual(expect.stringContaining("Remove resolved"));
    expect(errors).toContainEqual(expect.stringContaining("missing file"));
    expect(errors).toContainEqual(expect.stringContaining("owner is required"));
    expect(errors).toContainEqual(expect.stringContaining("rationale must explain"));
  });
});
