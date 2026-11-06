import { describe, expect, test } from "vite-plus/test";
import { typeChange } from "../kvEdit";
import { areaEntries, forageEntries } from "../kvModel";

const [count] = areaEntries([{ key: "count", value: "3" }]);
const [prefs] = areaEntries([{ key: "prefs", value: '{"a":1}' }]);
const [name] = areaEntries([{ key: "name", value: "Ana" }]);
const [flag] = forageEntries({
  entries: [{ key: "flag", value: true, editable: true }],
  more: false,
  total: 1,
});

describe("a draft of another type (B3)", () => {
  test("warns when a number becomes text or an object becomes a list", () => {
    expect(typeChange("local", count ?? null, "text", "three")).toMatch(
      /from Number to Text: the app may not read it back/,
    );
    expect(typeChange("local", prefs ?? null, "json", "[1]")).toMatch(/JSON object to JSON list/);
    expect(typeChange("forage", flag ?? null, "json", '"yes"')).toMatch(/Boolean to Text/);
  });

  test("says nothing when the type stays, or text stays text", () => {
    expect(typeChange("local", count ?? null, "text", "4")).toBeNull();
    expect(typeChange("local", name ?? null, "text", "")).toBeNull();
    expect(typeChange("local", null, "text", "x")).toBeNull();
    expect(typeChange("forage", flag ?? null, "json", "{")).toBeNull();
  });
});
