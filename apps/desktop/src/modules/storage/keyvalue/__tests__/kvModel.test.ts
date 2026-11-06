import { describe, expect, test } from "vite-plus/test";
import { areaEntries, describeText, forageEntries, patchEntries, utf8Length } from "../kvModel";
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

describe("the list follows a write without a new read (F2)", () => {
  const list = areaEntries([
    { key: "a", value: "1" },
    { key: "b", value: "2" },
    { key: "c", value: "3" },
  ]);

  test("a save replaces the row in place, a rename keeps its place, a new key goes last", () => {
    const [a, b] = list;
    const saved = patchEntries(
      list,
      { kind: "saved", previous: b ?? null, key: "b", value: "9" },
      "local",
    );
    expect(saved?.map((entry) => [entry.key, entry.stored])).toEqual([
      ["a", "1"],
      ["b", "9"],
      ["c", "3"],
    ]);
    const renamed = patchEntries(
      list,
      { kind: "saved", previous: a ?? null, key: "z", value: "1" },
      "local",
    );
    expect(renamed?.map((entry) => entry.key)).toEqual(["z", "b", "c"]);
    const added = patchEntries(
      list,
      { kind: "saved", previous: null, key: "d", value: "4" },
      "session",
    );
    expect(added?.map((entry) => entry.key)).toEqual(["a", "b", "c", "d"]);
  });

  test("deleted rows go; a LocalForage save asks for a new read", () => {
    const [, b] = list;
    expect(patchEntries(list, { kind: "removed", ids: [b?.id ?? ""] }, "forage")?.length).toBe(2);
    expect(
      patchEntries(list, { kind: "saved", previous: null, key: "x", value: 1 }, "forage"),
    ).toBeNull();
  });
});
