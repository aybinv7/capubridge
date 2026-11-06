import { describe, expect, it } from "vite-plus/test";
import { buildConsoleRows } from "@/lib/console/consoleRows";
import { RingBuffer } from "@/lib/ring-buffer";
import type { ConsoleEntry, ConsoleEntryLevel } from "@/types/console.types";

let seq = 0;

function entry(
  id: string,
  message: string,
  options: { level?: ConsoleEntryLevel; parentId?: string; group?: boolean } = {},
): ConsoleEntry {
  seq += 1;
  return {
    seq,
    id,
    targetId: "t",
    timestamp: seq,
    timestampLabel: "",
    level: options.level ?? "log",
    source: "app.js:1",
    message,
    args: [],
    parentId: options.parentId ?? null,
    isGroup: options.group ?? false,
    groupCollapsed: false,
    origin: "runtime",
    type: "log",
    url: null,
    lineNumber: null,
    columnNumber: null,
  };
}

function ring(entries: ConsoleEntry[]): RingBuffer<ConsoleEntry> {
  const buffer = new RingBuffer<ConsoleEntry>(100);
  buffer.pushAll(entries);
  return buffer;
}

const expanded = { isExpanded: () => true };

describe("buildConsoleRows", () => {
  it("lists flat entries in order", () => {
    const rows = buildConsoleRows(ring([entry("a", "one"), entry("b", "two")]), {
      test: null,
      ...expanded,
    });
    expect(rows.map((row) => [row.entry.id, row.depth])).toEqual([
      ["a", 0],
      ["b", 0],
    ]);
  });

  it("nests group children and hides them when collapsed", () => {
    const entries = [
      entry("g", "group", { group: true }),
      entry("c1", "child", { parentId: "g" }),
      entry("after", "after"),
    ];
    const open = buildConsoleRows(ring(entries), { test: null, ...expanded });
    expect(open.map((row) => [row.entry.id, row.depth])).toEqual([
      ["g", 0],
      ["c1", 1],
      ["after", 0],
    ]);
    const closed = buildConsoleRows(ring(entries), {
      test: null,
      isExpanded: () => false,
    });
    expect(closed.map((row) => row.entry.id)).toEqual(["g", "after"]);
  });

  it("keeps the groups on the path to a match", () => {
    const entries = [
      entry("g", "outer", { group: true }),
      entry("h", "inner", { group: true, parentId: "g" }),
      entry("hit", "needle", { parentId: "h", level: "error" }),
      entry("miss", "hay"),
    ];
    const rows = buildConsoleRows(ring(entries), {
      test: (item) => item.message === "needle",
      ...expanded,
    });
    expect(rows.map((row) => row.entry.id)).toEqual(["g", "h", "hit"]);
    const errors = buildConsoleRows(ring(entries), {
      test: (item) => item.level === "error",
      ...expanded,
    });
    expect(errors.map((row) => row.entry.id)).toEqual(["g", "h", "hit"]);
  });

  it("shows children whose group was evicted at the top level", () => {
    const rows = buildConsoleRows(ring([entry("orphan", "left", { parentId: "gone" })]), {
      test: null,
      ...expanded,
    });
    expect(rows.map((row) => [row.entry.id, row.depth])).toEqual([["orphan", 0]]);
  });
});
