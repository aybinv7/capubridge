import { describe, expect, test } from "vite-plus/test";
import type { ConsoleStreamItem } from "@/lib/console/consoleStream";
import type { ConsoleArg, ConsoleEntry, StackFrame } from "@/types/console.types";
import { consoleHasDetail } from "../consoleDetail";
import { consoleSourceLabel } from "../consoleTone";

function item(
  message: string,
  options: { args?: ConsoleArg[]; frames?: StackFrame[]; source?: string } = {},
): ConsoleStreamItem {
  const entry: ConsoleEntry = {
    seq: 1,
    id: "1",
    targetId: "t",
    timestamp: 0,
    timestampLabel: "",
    level: "info",
    source: options.source ?? "runtime",
    message,
    args: options.args ?? [{ kind: "primitive", text: message, valueType: "string" }],
    parentId: null,
    isGroup: false,
    groupCollapsed: false,
    origin: "runtime",
    type: "info",
    url: null,
    lineNumber: null,
    columnNumber: null,
    frames: options.frames ?? null,
  };
  return { kind: "entry", key: "1", seq: 1, time: 0, entry };
}

describe("consoleHasDetail", () => {
  test("a plain line opens into nothing, as in DevTools", () => {
    // The CapgoUpdater line that opened into a copy of itself.
    expect(consoleHasDetail(item("[CapgoUpdater] Background timestamp unset"))).toBe(false);
  });

  test("an object, a stack or JSON opens", () => {
    const object: ConsoleArg = {
      kind: "object",
      description: "Object",
      subtype: null,
      properties: [],
      overflow: false,
      objectId: "1",
    };
    expect(consoleHasDetail(item("x", { args: [object] }))).toBe(true);
    const frame = { functionName: "f", source: "a.js:1:1" } as StackFrame;
    expect(consoleHasDetail(item("x", { frames: [frame] }))).toBe(true);
    expect(consoleHasDetail(item('payload {"id":1,"ok":true}'))).toBe(true);
  });

  test("lines past the inline limit open", () => {
    const long = Array.from({ length: 30 }, (_, index) => `line ${index}`).join("\n");
    expect(consoleHasDetail(item(long))).toBe(true);
  });
});

describe("consoleSourceLabel", () => {
  test("shows file and line, like DevTools beside a message", () => {
    expect(consoleSourceLabel(item("x", { source: "index-GuGSBhrW.js:161:259" }))).toBe(
      "index-GuGSBhrW.js:161",
    );
    expect(consoleSourceLabel(item("x", { source: "runtime" }))).toBeNull();
  });
});
