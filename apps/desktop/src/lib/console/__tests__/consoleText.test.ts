import { describe, expect, it } from "vite-plus/test";
import { consoleCallText } from "@/lib/console/consoleText";
import type { ConsoleArg } from "@/types/console.types";

const text = (value: string): ConsoleArg => ({ kind: "primitive", text: value });
const object = (description: string): ConsoleArg => ({
  kind: "object",
  description,
  subtype: null,
  properties: [],
  overflow: false,
  objectId: null,
});

describe("consoleCallText", () => {
  it("drops %c styles and their CSS arguments", () => {
    expect(
      consoleCallText([
        text("%cnative %cDevice.getBatteryInfo (#12)"),
        text("font-weight: lighter; color: gray"),
        text("font-weight: bold; color: #000"),
      ]),
    ).toBe("native Device.getBatteryInfo (#12)");
  });

  it("substitutes %s %d %i %f %o and keeps the rest", () => {
    expect(
      consoleCallText([
        text("%s took %d ms (%f%%) %o"),
        text("sync"),
        text("41.7"),
        text("3.5"),
        object("Object"),
        text("extra"),
      ]),
    ).toBe("sync took 41 ms (3.5%) Object extra");
  });

  it("joins plain arguments and leaves unmatched specifiers alone", () => {
    expect(consoleCallText([text("a"), object("Array(2)")])).toBe("a Array(2)");
    expect(consoleCallText([text("%s and %s"), text("one")])).toBe("one and %s");
  });
});
