import { describe, expect, test } from "vite-plus/test";
import type { CacheStorageCatalog, CacheStorageEntry } from "@capubridge/cdp-protocol";
import { cacheBodyView } from "../cacheBody";
import { freshnessOf, freshnessWords } from "../cacheFreshness";
import { gridRowOf, shownRows } from "../cacheGrid";
import { entryName, toRow } from "../cacheModel";
import { buildCacheSections, resolveCache } from "../cacheSources";
import { EMPTY_SETTINGS, detail, entry } from "./cacheFixtures";

const NOW = Date.parse("Fri, 06 Nov 2026 12:00:00 GMT");

describe("freshness from the response's own headers", () => {
  test("max-age counts from the Date header plus the Age it already had", () => {
    const fresh = freshnessOf(
      {
        date: "Fri, 06 Nov 2026 11:00:00 GMT",
        age: "600",
        "cache-control": "public, max-age=7200",
      },
      NOW,
    );
    expect(fresh.state).toBe("fresh");
    expect(fresh.ageMs).toBe(70 * 60_000);
    expect(freshnessWords(fresh)).toBe("Fresh for 50 min more (max-age 2 h)");
  });

  test("an old response is expired, with how long ago", () => {
    const stale = freshnessOf(
      { date: "Thu, 05 Nov 2026 12:00:00 GMT", "cache-control": "max-age=3600" },
      NOW,
    );
    expect(stale.state).toBe("expired");
    expect(freshnessWords(stale)).toBe("Expired 23 h ago (max-age 1 h)");
  });

  test("Expires is read when there is no max-age; no-cache and no-store are named", () => {
    const expires = freshnessOf(
      { date: "Fri, 06 Nov 2026 10:00:00 GMT", expires: "Fri, 06 Nov 2026 14:00:00 GMT" },
      NOW,
    );
    expect(expires).toMatchObject({ state: "fresh", rule: "Expires", remainingMs: 2 * 3_600_000 });
    expect(freshnessOf({ "cache-control": "no-cache" }, NOW).state).toBe("revalidate");
    expect(freshnessOf({ "cache-control": "no-store" }, NOW).state).toBe("no-store");
    expect(freshnessWords(freshnessOf({}, NOW))).toBe("Its headers set no lifetime");
  });
});

describe("rows of a cache", () => {
  test("name first, then the address without the scheme", () => {
    expect(entryName("https://app.test/api/orders?page=2")).toEqual({
      name: "orders?page=2",
      address: "app.test/api/orders?page=2",
    });
    expect(entryName("https://cdn.test/")).toEqual({ name: "cdn.test", address: "cdn.test/" });
  });

  test("status, type, size and served date come from the list read", () => {
    const row = toRow(
      entry({
        id: "a",
        url: "https://app.test/app.js",
        contentType: "text/javascript; charset=utf-8",
        size: 2048,
      }),
    );
    expect(row).toMatchObject({ status: 200, statusLabel: "200", kind: "Script", size: 2048 });
    expect(row.servedAt).toBe(Date.parse("Thu, 05 Nov 2026 10:00:00 GMT"));
    expect(gridRowOf(row, NOW).cells["size"]).toBe("2 KB");
  });

  test("an opaque response says so instead of a status of 0", () => {
    const row = toRow(
      entry({ id: "o", url: "https://cdn.test/font.woff2", type: "opaque", status: 0, size: null }),
    );
    expect(row).toMatchObject({
      opaque: true,
      status: null,
      statusLabel: "Opaque",
      kind: "Opaque",
    });
    expect(gridRowOf(row, NOW).cells["size"]).toBe("—");
  });

  test("an entry the read had no time for shows dashes, not zeros", () => {
    const bare: CacheStorageEntry = {
      id: "x",
      url: "https://app.test/x",
      method: "GET",
      version: "",
      response: null,
    };
    expect(toRow(bare)).toMatchObject({ statusLabel: "—", kind: "—", size: null, status: null });
  });

  test("find looks in the address, method, status and type; sort keeps unknown sizes last", () => {
    const rows = [
      toRow(
        entry({
          id: "1",
          url: "https://app.test/a.json",
          contentType: "application/json",
          size: 10,
        }),
      ),
      toRow(
        entry({ id: "2", url: "https://app.test/b.png", contentType: "image/png", size: null }),
      ),
      toRow(
        entry({
          id: "3",
          url: "https://app.test/c.css",
          contentType: "text/css",
          size: 5,
          status: 404,
        }),
      ),
    ];
    expect(shownRows(rows, "IMAGE", null).map((row) => row.id)).toEqual(["2"]);
    expect(shownRows(rows, "404", null).map((row) => row.id)).toEqual(["3"]);
    const bySize = shownRows(rows, "", { columnId: "size", direction: "asc" });
    expect(bySize.map((row) => row.id)).toEqual(["3", "1", "2"]);
  });
});

describe("the sidebar and the address", () => {
  const catalog: CacheStorageCatalog = {
    origin: "https://localhost",
    available: true,
    caches: [
      { name: "workbox-precache-v2", count: 40 },
      { name: "api", count: 3 },
    ],
  };

  test("one source, the page, with its caches and their counts", () => {
    const [section] = buildCacheSections({
      catalog,
      settings: () => EMPTY_SETTINGS,
      open: "api",
      openCount: 5,
    });
    const source = section?.sources[0];
    expect(source).toMatchObject({
      id: "https://localhost",
      label: "This page",
      detail: "localhost",
    });
    expect(source?.collections.map((item) => [item.id, item.count])).toEqual([
      ["workbox-precache-v2", 40],
      ["api", 5],
    ]);
  });

  test("a page without Cache storage says why in the sidebar", () => {
    const [section] = buildCacheSections({
      catalog: { origin: "http://app", available: false, caches: [] },
      settings: () => EMPTY_SETTINGS,
      open: null,
      openCount: null,
    });
    expect(section?.sources).toEqual([]);
    expect(section?.empty).toMatch(/secure page/);
  });

  test("a link to a cache that is gone says so instead of showing another cache", () => {
    expect(resolveCache("api", catalog)).toEqual({ cache: "api", missing: null });
    expect(resolveCache("old", catalog)).toEqual({
      cache: null,
      missing: "“old” is not in this page's Cache storage any more.",
    });
    expect(resolveCache("api", undefined)).toEqual({ cache: null, missing: null });
  });
});

describe("the body in the pane", () => {
  test("a whole JSON body is shown as JSON", () => {
    const view = cacheBodyView(
      detail({ body: '{"a":1}', contentType: "application/json", size: 7 }),
    );
    expect(view?.content.kind).toBe("json");
    expect(view?.notice).toBeNull();
  });

  test("a body cut at the cap is shown as text, saying how much is shown", () => {
    const view = cacheBodyView(
      detail({ body: '{"a":[1,2', contentType: "application/json", size: 4096, read: 9 }),
    );
    expect(view?.content.kind).toBe("text");
    expect(view?.notice).toBe("Showing the first 9 B of 4 KB.");
  });

  test("an opaque response has no body view", () => {
    expect(
      cacheBodyView({ ...detail({ body: "", contentType: "", size: null }), body: null }),
    ).toBeNull();
  });
});
