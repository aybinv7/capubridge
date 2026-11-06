import { describe, expect, it } from "vite-plus/test";
import { compileConsoleQuery } from "@/lib/console/consoleQuery";
import { groupConsoleErrors, isAppFrame } from "@/lib/console/consoleErrors";
import { buildConsoleStream, type ConsoleStreamRow } from "@/lib/console/consoleStream";
import { ConsoleStreamView } from "@/lib/console/consoleStreamView";
import { RingBuffer } from "@/lib/ring-buffer";
import type {
  ConsoleEntry,
  ConsoleEntryLevel,
  ConsoleExceptionEntry,
  ReplHistoryEntry,
  StackFrame,
} from "@/types/console.types";

let seq = 0;

function frame(url: string, line = 1): StackFrame {
  return { functionName: "fn", url, lineNumber: line, columnNumber: 1, source: `x.js:${line}` };
}

function entry(
  message: string,
  level: ConsoleEntryLevel = "log",
  extra: Partial<ConsoleEntry> = {},
): ConsoleEntry {
  seq += 1;
  return {
    seq,
    id: `e${seq}`,
    targetId: "t",
    timestamp: seq,
    timestampLabel: "",
    level,
    source: "app.js:1",
    message,
    args: [],
    parentId: null,
    isGroup: false,
    groupCollapsed: false,
    origin: "runtime",
    type: level,
    url: "https://app.test/app.js",
    lineNumber: 1,
    columnNumber: 1,
    ...extra,
  };
}

function exception(message: string, frames: StackFrame[] = []): ConsoleExceptionEntry {
  seq += 1;
  return {
    seq,
    id: `x${seq}`,
    targetId: "t",
    timestamp: seq,
    timestampLabel: "",
    message,
    source: "app.js:9",
    url: "https://app.test/app.js",
    lineNumber: 9,
    columnNumber: 1,
    stack: [],
    frames,
  };
}

function repl(expression: string, result: string): ReplHistoryEntry {
  seq += 2;
  return {
    seq: seq - 1,
    resultSeq: seq,
    id: `r${seq}`,
    targetId: "t",
    timestamp: seq,
    timestampLabel: "",
    expression,
    result,
    status: "ok",
  };
}

function rings(entries: ConsoleEntry[], exceptions: ConsoleExceptionEntry[]) {
  const entryRing = new RingBuffer<ConsoleEntry>(100);
  entryRing.pushAll(entries);
  const exceptionRing = new RingBuffer<ConsoleExceptionEntry>(100);
  exceptionRing.pushAll(exceptions);
  return { entries: entryRing, exceptions: exceptionRing };
}

const hostTime = { hostTime: (item: { time: number }) => item.time };

function label(row: ConsoleStreamRow): string {
  return row.item.kind === "entry" ? row.item.entry.message : row.item.kind;
}

describe("console stream", () => {
  it("interleaves messages, exceptions and prompt lines in order and folds repeats", () => {
    const first = entry("ready");
    const boom = exception("TypeError: boom");
    const tick1 = entry("tick");
    const tick2 = entry("tick");
    const run = repl("1 + 1", "2");
    const tick3 = entry("tick");
    const rows = buildConsoleStream({
      ...rings([first, tick1, tick2, tick3], [boom]),
      repl: [run],
      test: null,
      isExpanded: () => true,
    });
    expect(rows.map((row) => `${row.item.kind}x${row.count}`)).toEqual([
      "entryx1",
      "exceptionx1",
      "entryx2",
      "inputx1",
      "resultx1",
      "entryx1",
    ]);
    expect(rows[2]?.key).toBe(tick1.id);
    expect(rows[2]?.item.key).toBe(tick2.id);
  });

  it("filters every kind with the shared grammar", () => {
    const sources = rings(
      [
        entry("loaded", "info"),
        entry("slow frame", "warn"),
        entry("bad", "error", { url: "https://cdn.test/lib.js" }),
      ],
      [exception("ReferenceError: x")],
    );
    const query = compileConsoleQuery("level:warn -url:cdn.test", hostTime);
    const rows = buildConsoleStream({
      ...sources,
      repl: [],
      test: query.predicate,
      isExpanded: () => true,
    });
    expect(rows.map((row) => row.item.kind)).toEqual(["entry", "exception"]);
    expect(compileConsoleQuery("level:error", hostTime).levelFloor).toBe(3);
  });
});

describe("console stream view", () => {
  it("keeps rows in step with flushes, evictions included", () => {
    const entries = new RingBuffer<ConsoleEntry>(4);
    const exceptions = new RingBuffer<ConsoleExceptionEntry>(4);
    const view = new ConsoleStreamView(() => ({
      entries,
      exceptions,
      repl: [],
      test: null,
      isExpanded: () => true,
    }));
    view.rebuild();
    function flush(batch: ConsoleEntry[]) {
      const ok = view.applyEntries({
        kind: "append",
        items: batch,
        evicted: entries.pushAll(batch),
      });
      return ok;
    }
    expect(flush([entry("a"), entry("a"), entry("b")])).toBe(true);
    expect(view.rows.map((row) => `${label(row)}x${row.count}`)).toEqual(["ax2", "bx1"]);
    expect(flush([entry("b"), entry("c")])).toBe(true);
    expect(view.rows.map((row) => `${label(row)}x${row.count}`)).toEqual(["ax1", "bx2", "cx1"]);
    const incremental = view.rows.map((row) => `${row.item.key}:${row.count}`);
    view.rebuild();
    expect(view.rows.map((row) => `${row.item.key}:${row.count}`)).toEqual(incremental);
    expect(flush([entry("g", "log", { isGroup: true })])).toBe(false);
  });
});

describe("console errors", () => {
  it("groups by first line and top app frame, newest first", () => {
    const appFrame = frame("https://app.test/cart.js", 12);
    const libFrame = frame("https://app.test/node_modules/vue.js", 3);
    const groups = groupConsoleErrors({
      ...rings(
        [
          entry("Failed to save\nmore", "error", { frames: [libFrame, appFrame] }),
          entry("ignored", "warn"),
          entry("Failed to save", "error", { frames: [appFrame] }),
        ],
        [exception("TypeError: boom", [appFrame]), exception("TypeError: boom", [appFrame])],
      ),
      appOrigin: "https://app.test",
      test: null,
    });
    expect(groups.map((group) => [group.message, group.count, group.exceptions])).toEqual([
      ["TypeError: boom", 2, 2],
      ["Failed to save", 2, 0],
    ]);
    expect(groups[1]?.frame?.lineNumber).toBe(12);
    expect(isAppFrame(libFrame, "https://app.test")).toBe(false);
    expect(isAppFrame(frame("https://other.test/a.js"), "https://app.test")).toBe(false);
  });
});
