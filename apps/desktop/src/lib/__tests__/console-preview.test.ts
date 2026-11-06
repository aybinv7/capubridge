import { describe, expect, test } from "vite-plus/test";
import { argsPreview, previewJson, valuePreview } from "@/lib/console/consolePreview";
import { parseRemoteValue } from "@/lib/console-parse";
import type { ConsoleArg } from "@/types/console.types";

function text(segments: { text: string }[]): string {
  return segments.map((segment) => segment.text).join("");
}

const BRIDGE_CALL = parseRemoteValue({
  type: "object",
  description: "Object",
  objectId: "1.2.3",
  preview: {
    type: "object",
    description: "Object",
    overflow: false,
    properties: [
      { name: "callbackId", type: "number", value: "104196846" },
      { name: "pluginId", type: "string", value: "Network" },
      { name: "methodName", type: "string", value: "getStatus" },
      { name: "options", type: "object", value: "Object" },
    ],
  },
});

describe("console previews", () => {
  test("a call with an object reads like DevTools instead of 'Object'", () => {
    expect(text(argsPreview([BRIDGE_CALL]))).toBe(
      "{callbackId: 104196846, pluginId: 'Network', methodName: 'getStatus', options: {…}}",
    );
  });

  test("top-level text stays unquoted and %c styles are dropped", () => {
    const args: ConsoleArg[] = [
      { kind: "primitive", text: "%cnative%c Network.getStatus", valueType: "string" },
      { kind: "primitive", text: "color: blue", valueType: "string" },
      { kind: "primitive", text: "", valueType: "string" },
      BRIDGE_CALL,
    ];
    expect(text(argsPreview(args))).toBe(
      "native Network.getStatus {callbackId: 104196846, pluginId: 'Network', methodName: 'getStatus', options: {…}}",
    );
  });

  test("arrays and named objects keep their kind", () => {
    const array = parseRemoteValue({
      type: "object",
      subtype: "array",
      description: "Array(3)",
      objectId: "a",
      preview: {
        overflow: false,
        properties: [
          { name: "0", type: "number", value: "1" },
          { name: "1", type: "string", value: "two" },
          { name: "2", type: "object", subtype: "null", value: "null" },
        ],
      },
    });
    expect(text(valuePreview(array))).toBe("Array(3) [1, 'two', null]");
    const map = parseRemoteValue({
      type: "object",
      subtype: "map",
      description: "Map(2)",
      objectId: "m",
    });
    expect(text(valuePreview(map))).toBe("Map(2)");
  });

  test("strings, numbers and literals keep their type for colour", () => {
    const tones = valuePreview(BRIDGE_CALL).map((segment) => segment.tone);
    expect(tones).toContain("number");
    expect(tones).toContain("string");
    expect(tones).toContain("key");
  });

  test("JSON of the preview keeps numbers as numbers", () => {
    expect(JSON.parse(previewJson(BRIDGE_CALL))).toEqual({
      callbackId: 104196846,
      pluginId: "Network",
      methodName: "getStatus",
      options: "Object",
    });
  });
});
