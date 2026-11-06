import { describe, expect, test } from "vite-plus/test";
import type { KeyValueDiscovery } from "@capubridge/cdp-protocol";
import { buildKvSections, collectionIdOf, resolveSource, sourceFromSelection } from "../kvSources";
import { makeSource } from "../kvModel";

const PAGE = "https://localhost";
const FRAME = "https://pay.example";

const discovery: KeyValueDiscovery = {
  pageOrigin: PAGE,
  origins: [PAGE, FRAME],
  counts: { local: 12, session: 0 },
  forage: [
    { database: "localforage", store: "keyvaluepairs", count: 4 },
    { database: "cache", store: "images", count: 9 },
  ],
  forageError: null,
};

const query = (partial: Partial<Record<"origin" | "source" | "database" | "store", string>>) => ({
  origin: "",
  source: "",
  database: "",
  store: "",
  ...partial,
});

describe("which list the tab opens", () => {
  test("the page's Local storage by default", () => {
    expect(resolveSource(query({}), discovery).source).toEqual(
      makeSource({ kind: "local", origin: PAGE }),
    );
  });

  test("the old LocalForage address opens a LocalForage store", () => {
    const { source } = resolveSource(query({ source: "forage" }), discovery);
    expect(source).toMatchObject({ kind: "forage", database: "localforage" });
    const named = resolveSource(query({ source: "forage", database: "cache" }), discovery);
    expect(named.source).toMatchObject({ database: "cache", store: "images" });
  });

  test("a list that is not on the page is said plainly, not swapped for another", () => {
    expect(resolveSource(query({ source: "forage", database: "gone" }), discovery)).toMatchObject({
      source: null,
    });
    expect(resolveSource(query({ origin: "https://old.test" }), discovery).missing).toMatch(
      /not on this page/,
    );
  });

  test("a sidebar row and its list are the same list both ways", () => {
    const list = makeSource({ kind: "forage", origin: PAGE, database: "a/b", store: "c" });
    expect(sourceFromSelection(PAGE, collectionIdOf(list))).toEqual(list);
  });
});

describe("the sidebar", () => {
  const settings = () => ({
    pinned: false,
    hidden: false,
    expanded: true,
    pinnedItems: [],
    hiddenItems: [],
  });

  test("lists each origin with its storage, LocalForage under the page only", () => {
    const [section] = buildKvSections({ discovery, settings, open: null, openCount: null });
    const [page, frame] = section?.sources ?? [];
    expect(page?.label).toBe("This page");
    expect(page?.collections.map((entry) => [entry.label, entry.count])).toEqual([
      ["Local storage", 12],
      ["Session storage", 0],
      ["LocalForage", 4],
      ["LocalForage “cache” › images", 9],
    ]);
    expect(frame?.collections.map((entry) => entry.label)).toEqual([
      "Local storage",
      "Session storage",
    ]);
  });

  test("the open list shows the count of its own read", () => {
    const open = makeSource({ kind: "local", origin: PAGE });
    const [section] = buildKvSections({ discovery, settings, open, openCount: 13 });
    expect(section?.sources[0]?.collections[0]?.count).toBe(13);
  });
});
