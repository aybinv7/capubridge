import { describe, expect, test } from "vite-plus/test";
import { EMPTY_TABS } from "../sqliteTabs";
import {
  pruneWorkspaces,
  pushRecent,
  readWorkspaces,
  sqliteWorkspaceKey,
} from "../sqliteWorkspace";

describe("recent tables", () => {
  test("the last opened comes first, once, and the list is capped", () => {
    expect(pushRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    const many = Array.from({ length: 12 }, (_, index) => `t${index}`);
    expect(pushRecent(many, "new")).toHaveLength(10);
  });

  test("the databases used least recently are pruned first", () => {
    const kept = pruneWorkspaces(
      {
        old: { recents: [], tabs: EMPTY_TABS, touchedAt: 1 },
        mid: { recents: [], tabs: EMPTY_TABS, touchedAt: 2 },
        new: { recents: [], tabs: EMPTY_TABS, touchedAt: 3 },
      },
      2,
    );
    expect(Object.keys(kept).sort()).toEqual(["mid", "new"]);
  });

  test("a corrupt stored value is dropped, not fatal", () => {
    expect(readWorkspaces("nope")).toEqual({});
    expect(
      readWorkspaces({ a: { recents: ["x"], touchedAt: 5 }, b: { recents: [3] }, c: null }),
    ).toEqual({ a: { recents: ["x"], tabs: EMPTY_TABS, touchedAt: 5 } });
  });

  test("an opened file keeps its workspace under its own path, a phone database under its scope", () => {
    expect(
      sqliteWorkspaceKey("R5::shop::sqlite", "file:42", {
        sourceKind: "imported",
        sourceFilePath: "C:/x/app.db",
        name: "app.db",
      }),
    ).toBe("file::C:/x/app.db");
    expect(sqliteWorkspaceKey("R5::shop::sqlite", "/data/shop.db", { name: "shop.db" })).toBe(
      "R5::shop::sqlite::/data/shop.db",
    );
  });
});
