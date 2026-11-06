import { describe, expect, it } from "vite-plus/test";
import { createConsoleBuffer } from "@/lib/console/consoleBuffer";
import { forwardConsoleTrack } from "@/lib/recording/consoleTrackFeed";
import { STREAM_CAPS } from "@/lib/stream-caps";
import type { ConsoleEntry } from "@/types/console.types";

function entries(from: number, count: number): ConsoleEntry[] {
  return Array.from({ length: count }, (_, offset) => {
    const seq = from + offset;
    return {
      seq,
      id: `t:runtime:${seq}`,
      targetId: "t",
      timestamp: seq,
      timestampLabel: "",
      level: "log",
      source: "app.js:1",
      message: `entry ${seq}`,
      args: [],
      parentId: null,
      isGroup: false,
      groupCollapsed: false,
      origin: "runtime",
      type: "log",
      url: null,
      lineNumber: null,
      columnNumber: null,
    };
  });
}

describe("forwardConsoleTrack", () => {
  it("keeps recording after the console buffer is full", () => {
    const buffer = createConsoleBuffer();
    const recorded: number[] = [];
    const stop = forwardConsoleTrack(buffer.entryFeed, (entry) => recorded.push(entry.seq));

    buffer.appendEntries(entries(0, STREAM_CAPS.console));
    buffer.appendEntries(entries(STREAM_CAPS.console, 3));
    buffer.appendEntries(entries(STREAM_CAPS.console + 3, 2));

    expect(buffer.entries.size).toBe(STREAM_CAPS.console);
    expect(recorded).toHaveLength(STREAM_CAPS.console + 5);
    expect(recorded.slice(-5)).toEqual([
      STREAM_CAPS.console,
      STREAM_CAPS.console + 1,
      STREAM_CAPS.console + 2,
      STREAM_CAPS.console + 3,
      STREAM_CAPS.console + 4,
    ]);

    stop();
    buffer.appendEntries(entries(STREAM_CAPS.console + 5, 1));
    expect(recorded).toHaveLength(STREAM_CAPS.console + 5);
  });

  it("ignores a clear", () => {
    const buffer = createConsoleBuffer();
    const recorded: number[] = [];
    forwardConsoleTrack(buffer.entryFeed, (entry) => recorded.push(entry.seq));
    buffer.appendEntries(entries(0, 2));
    buffer.clearEntries();
    buffer.appendEntries(entries(2, 1));
    expect(recorded).toEqual([0, 1, 2]);
  });
});
