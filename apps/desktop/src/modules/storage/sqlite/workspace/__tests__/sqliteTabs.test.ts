import { describe, expect, test } from "vite-plus/test";
import {
  closeTabs,
  dropMissing,
  EMPTY_TABS,
  investedIn,
  DEFAULT_QUERY,
  keepTab,
  neighbourId,
  openTab,
  othersThan,
  readTabs,
  reopenClosed,
  rightOf,
  TABS_CAP,
  type SqliteTabsState,
} from "../sqliteTabs";

const preview = { preview: true, now: 1 };
const kept = { preview: false, now: 1 };
const table = (name: string) => ({ kind: "table" as const, table: name });
const ids = (state: SqliteTabsState) =>
  state.tabs.map((tab) => `${tab.preview ? "/" : ""}${tab.id}`);

describe("preview tabs", () => {
  test("a single click replaces the preview tab in place", () => {
    let state = openTab(EMPTY_TABS, table("a"), kept);
    state = openTab(state, table("b"), preview);
    state = openTab(state, table("c"), preview);
    expect(ids(state)).toEqual(["table:a", "/table:c"]);
    expect(state.activeId).toBe("table:c");
  });

  test("double-click, quick open or an invested change keeps it", () => {
    let state = openTab(EMPTY_TABS, table("a"), preview);
    state = keepTab(state, "table:a");
    state = openTab(state, table("b"), preview);
    expect(ids(state)).toEqual(["table:a", "/table:b"]);
    state = openTab(state, table("b"), kept);
    expect(ids(state)).toEqual(["table:a", "table:b"]);
    expect(investedIn(DEFAULT_QUERY)).toBe(false);
    expect(investedIn({ ...DEFAULT_QUERY, orderBy: "id", orderDir: "ASC" })).toBe(true);
    expect(investedIn({ ...DEFAULT_QUERY, page: 3 })).toBe(false);
  });

  test("an open table is activated, never duplicated", () => {
    let state = openTab(EMPTY_TABS, table("a"), kept);
    state = openTab(state, { kind: "sql" }, kept);
    state = openTab(state, table("a"), preview);
    expect(ids(state)).toEqual(["table:a", "sql"]);
    expect(state.activeId).toBe("table:a");
  });

  test("a new tab opens right of the active one", () => {
    let state = openTab(EMPTY_TABS, table("a"), kept);
    state = openTab(state, table("b"), kept);
    state = openTab(state, table("a"), kept);
    state = openTab(state, table("c"), kept);
    expect(ids(state)).toEqual(["table:a", "table:c", "table:b"]);
  });
});

describe("closing", () => {
  const three = [table("a"), table("b"), table("c")].reduce(
    (state, spec) => openTab(state, spec, kept),
    EMPTY_TABS,
  );

  test("the focus moves right, else left, else to the Overview", () => {
    const middle = { ...three, activeId: "table:b" };
    expect(closeTabs(middle, new Set(["table:b"])).activeId).toBe("table:c");
    const last = { ...three, activeId: "table:c" };
    expect(closeTabs(last, new Set(["table:c"])).activeId).toBe("table:b");
    expect(closeTabs(three, othersThan(three, "x")).activeId).toBe("overview");
  });

  test("close others, to the right, and reopen the last closed as kept", () => {
    expect(ids(closeTabs(three, othersThan(three, "table:b")))).toEqual(["table:b"]);
    expect(ids(closeTabs(three, rightOf(three, "table:a")))).toEqual(["table:a"]);
    const closed = closeTabs(three, new Set(["table:b"]));
    const back = reopenClosed(closed, 2);
    expect(back.tabs.map((tab) => tab.id)).toContain("table:b");
    expect(back.activeId).toBe("table:b");
    expect(back.closed).toHaveLength(0);
  });

  test("past the cap the least used tab goes, never the active nor a protected one", () => {
    let state = EMPTY_TABS;
    for (let index = 0; index < TABS_CAP; index += 1) {
      state = openTab(state, table(`t${index}`), { preview: false, now: index });
    }
    state = openTab(state, table("new"), {
      preview: false,
      now: 99,
      protect: new Set(["table:t0"]),
    });
    expect(state.tabs).toHaveLength(TABS_CAP);
    expect(state.tabs.map((tab) => tab.id)).toContain("table:t0");
    expect(state.tabs.map((tab) => tab.id)).not.toContain("table:t1");
  });

  test("tabs of tables that are gone are dropped and counted", () => {
    const { state, dropped } = dropMissing(three, new Set(["a", "c"]));
    expect(dropped).toBe(1);
    expect(ids(state)).toEqual(["table:a", "table:c"]);
    expect(state.closed).toHaveLength(0);
  });

  test("next and previous wrap through the Overview", () => {
    const state = { ...three, activeId: "table:c" };
    expect(neighbourId(state, 1)).toBe("overview");
    expect(neighbourId({ ...three, activeId: "overview" }, -1)).toBe("table:c");
  });
});

describe("restore", () => {
  test("stored tabs come back; a corrupt value starts on the Overview", () => {
    const stored = JSON.parse(
      JSON.stringify(openTab(openTab(EMPTY_TABS, table("a"), kept), { kind: "diagram" }, kept)),
    ) as unknown;
    expect(readTabs(stored).tabs.map((tab) => tab.id)).toEqual(["table:a", "diagram"]);
    expect(readTabs(stored).activeId).toBe("diagram");
    expect(readTabs("nope")).toEqual(EMPTY_TABS);
    expect(readTabs({ tabs: [{ id: 3 }], activeId: "x" })).toEqual(EMPTY_TABS);
  });
});
