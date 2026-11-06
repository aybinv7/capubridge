import { describe, expect, test } from "vite-plus/test";
import { jsonInText } from "../jsonInText";

describe("JSON kept in text", () => {
  test("an object or array in text is shown parsed", () => {
    expect(jsonInText('{"a":1,"b":[2]}')).toBe('{\n  "a": 1,\n  "b": [\n    2\n  ]\n}');
    expect(jsonInText(" [1, 2]")).toBe("[\n  1,\n  2\n]");
  });

  test("anything else stays text", () => {
    expect(jsonInText("hello")).toBeNull();
    expect(jsonInText("42")).toBeNull();
    expect(jsonInText('"quoted"')).toBeNull();
    expect(jsonInText("{not json")).toBeNull();
    expect(jsonInText(12)).toBeNull();
    expect(jsonInText(null)).toBeNull();
  });
});
