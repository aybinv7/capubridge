import { describe, expect, test } from "vite-plus/test";
import type { InlineBlock, InlineLine } from "@/lib/console/consoleLines";
import { consoleRowHeight } from "../consoleRowHeight";

const LINE: InlineLine = { kind: "message", segments: [{ text: "x", tone: "text" }] };

function block(lines: number, hidden = 0): InlineBlock {
  return { lines: Array.from({ length: lines }, () => LINE), hidden };
}

describe("consoleRowHeight", () => {
  test("a one-line message stays one 22 px row", () => {
    expect(consoleRowHeight(block(1))).toBe(22);
  });

  test("each further line adds 16 px, plus the block's bottom padding", () => {
    expect(consoleRowHeight(block(4))).toBe(22 + 3 * 16 + 4);
  });

  test("the 'more lines' note counts as a line", () => {
    expect(consoleRowHeight(block(20, 5))).toBe(22 + 20 * 16 + 4);
  });
});
