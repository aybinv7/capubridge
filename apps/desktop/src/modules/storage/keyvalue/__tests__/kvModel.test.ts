import { describe, expect, test } from "vite-plus/test";
import { areaEntries, describeText, forageEntries, utf8Length } from "../kvModel";
import { initialDraft, initialMode, switchDraft, valueToWrite } from "../kvEdit";

describe("reading stored text", () => {
  test("says what a value holds, the way an app reads it", () => {
    expect(describeText('{"a":1}').label).toBe("JSON object");
    expect(describeText("[1,2]").label).toBe("JSON list");
    expect(describeText("42").label).toBe("Number");
    expect(describeText("true").label).toBe("Boolean");
    expect(describeText("2026-11-05T10:00:00Z").label).toBe("Date as text");
    expect(describeText("{not json").label).toBe("Text");
    expect(describeText("").label).toBe("Empty");
  });

  test("rows are identified by their key, never by their position", () => {
    const first = areaEntries([
      { key: "a", value: "1" },
      { key: "b", value: "2" },
    ]);
    const reordered = areaEntries([
      { key: "b", value: "2" },
      { key: "a", value: "1" },
    ]);
    expect(first.find((entry) => entry.key === "a")?.id).toBe(
      reordered.find((entry) => entry.key === "a")?.id,
    );
  });

  test("sizes count UTF-8 bytes", () => {
    expect(utf8Length("abc")).toBe(3);
    expect(utf8Length("é")).toBe(2);
    expect(utf8Length("😀")).toBe(4);
  });
});

describe("LocalForage values", () => {
  test("a value JSON cannot carry stays read-only with its reason, shown in words", () => {
    const [date] = forageEntries({
      entries: [
        {
          key: "when",
          value: { __type: "Date", value: "2026-11-05T10:00:00.000Z" },
          editable: false,
          readOnlyReason: "Is a Date; saving it here would turn it into text.",
        },
      ],
      more: false,
      total: 1,
    });
    expect(date?.typeLabel).toBe("Date");
    expect(date?.readOnlyReason).toMatch(/Date/);
  });

  test("the compared text is the encoded value, exactly as read", () => {
    const [entry] = forageEntries({
      entries: [{ key: "cart", value: { items: [1, 2] }, editable: true }],
      more: false,
      total: 1,
    });
    expect(entry?.stored).toBe('{"items":[1,2]}');
    expect(entry?.readOnlyReason).toBeNull();
  });
});

describe("editing keeps the stored format (M11, C29)", () => {
  const [minified] = areaEntries([{ key: "prefs", value: '{"a":1,"b":[1,2]}' }]);

  test("a minified JSON value opens exactly as stored, so opening it changes nothing", () => {
    if (!minified) throw new Error("no entry");
    const mode = initialMode("local", minified);
    expect(mode).toBe("json");
    expect(initialDraft("local", minified, mode)).toBe('{"a":1,"b":[1,2]}');
  });

  test("Local storage saves the text exactly as typed, in either mode", () => {
    expect(valueToWrite("local", "json", '{ "a": 1 }')).toBe('{ "a": 1 }');
    expect(valueToWrite("session", "text", "  spaced  ")).toBe("  spaced  ");
    expect(switchDraft("local", "text", '{"a":1}')).toBe('{"a":1}');
  });

  test("LocalForage saves text as text and JSON as the value it holds", () => {
    expect(valueToWrite("forage", "text", "42")).toBe("42");
    expect(valueToWrite("forage", "json", "42")).toBe(42);
    expect(switchDraft("forage", "json", "hello")).toBe('"hello"');
    expect(switchDraft("forage", "text", '"hello"')).toBe("hello");
  });
});
