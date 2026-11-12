import { describe, expect, test } from "vite-plus/test";
import { INLINE_LINE_LIMIT, inlineBlock, shortLocation } from "@/lib/console/consoleLines";
import type { ConsoleStreamItem } from "@/lib/console/consoleStream";
import type { ConsoleArg, ConsoleEntry } from "@/types/console.types";

const STACK =
  "Error: 'readdir' failed\n" +
  "    at returnResult (https://localhost/assets/index-DhC22Qhr.js:961:32)\n" +
  "    at win.androidBridge.onmessage (<anonymous>:936:21)";

function item(args: ConsoleArg[], message = ""): ConsoleStreamItem {
  const entry: ConsoleEntry = {
    seq: 1,
    id: "1",
    targetId: "t",
    timestamp: 0,
    timestampLabel: "",
    level: "error",
    source: "runtime",
    message,
    args,
    parentId: null,
    isGroup: false,
    groupCollapsed: false,
    origin: "runtime",
    type: "error",
    url: null,
    lineNumber: null,
    columnNumber: null,
  };
  return { kind: "entry", key: "1", seq: 1, time: 0, entry };
}

function text(segments: { text: string }[]): string {
  return segments.map((segment) => segment.text).join("");
}

const PLUGIN_ERROR: ConsoleArg = {
  kind: "object",
  description: STACK,
  subtype: "error",
  objectId: "9.9.9",
  overflow: false,
  properties: [
    { name: "code", value: { kind: "primitive", text: "OS-PLUG-FILE-0008", valueType: "string" } },
    { name: "stack", value: { kind: "primitive", text: STACK, valueType: "string" } },
    {
      name: "message",
      value: { kind: "primitive", text: "'readdir' failed", valueType: "string" },
    },
  ],
};

describe("inlineBlock", () => {
  test("lays out the Efficy plugin error like DevTools: message, frames, then its fields", () => {
    const block = inlineBlock(
      item([
        { kind: "primitive", text: "[copyImagesToNewFolder]", valueType: "string" },
        PLUGIN_ERROR,
      ]),
    );
    expect(block.lines.map((line) => line.kind)).toEqual(["message", "frame", "frame", "message"]);
    expect(text(block.lines[0].segments)).toBe("[copyImagesToNewFolder] Error: 'readdir' failed");
    expect(text(block.lines[1].segments)).toBe("    at returnResult (index-DhC22Qhr.js:961:32)");
    expect(block.lines[1].segments.find((s) => s.tone === "location")?.text).toBe(
      "index-DhC22Qhr.js:961:32",
    );
    expect(text(block.lines[3].segments)).toBe("{code: 'OS-PLUG-FILE-0008'}");
    expect(block.hidden).toBe(0);
  });

  test("a plain message's own line breaks are kept", () => {
    const block = inlineBlock(item([], "first\nsecond\n"));
    expect(block.lines.map((line) => text(line.segments))).toEqual(["first", "second"]);
  });

  test("text that merely starts with 'at' is not a frame", () => {
    const block = inlineBlock(item([], "status\nat home now"));
    expect(block.lines[1].kind).toBe("message");
  });

  test("a huge message is bounded and says how much it left for the detail", () => {
    const lines = Array.from({ length: INLINE_LINE_LIMIT + 5 }, (_, index) => `line ${index}`);
    const block = inlineBlock(item([], lines.join("\n")));
    expect(block.lines).toHaveLength(INLINE_LINE_LIMIT);
    expect(block.hidden).toBe(5);
  });

  test("is computed once per item, since the list asks for heights too", () => {
    const current = item([], "a\nb");
    expect(inlineBlock(current)).toBe(inlineBlock(current));
  });
});

describe("shortLocation", () => {
  test("keeps the file, line and column", () => {
    expect(shortLocation("https://localhost/assets/index-a1.js:961:32")).toBe("index-a1.js:961:32");
    expect(shortLocation("<anonymous>:936:21")).toBe("<anonymous>:936:21");
  });
});
