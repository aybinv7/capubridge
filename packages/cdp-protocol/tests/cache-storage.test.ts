import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  CacheStorageChangedError,
  CacheStorageDomain,
  CacheStorageGoneError,
  CacheStorageWrongOriginError,
} from "../src/cdp/domains/cache-storage.ts";
import {
  FakeCacheStorage,
  installCaches,
  opaqueResponse,
  type FakeCache,
} from "./cache-storage-fixture.ts";
import { PAGE, fakeOrigin, pageClient } from "./keyvalue-fixture.ts";

const API = `${PAGE}/api/orders`;

function setup(): { storage: FakeCacheStorage; domain: CacheStorageDomain } {
  const storage = new FakeCacheStorage();
  installCaches(storage);
  return { storage, domain: new CacheStorageDomain(pageClient({ [PAGE]: fakeOrigin() })) };
}

function json(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      date: "Thu, 05 Nov 2026 10:00:00 GMT",
      ...headers,
    },
  });
}

function variants(cache: FakeCache) {
  cache.put(
    new Request(API, { headers: { "accept-language": "fr" } }),
    json({ lang: "fr" }, { vary: "accept-language" }),
  );
  cache.put(
    new Request(API, { headers: { "accept-language": "en" } }),
    json({ lang: "en" }, { vary: "accept-language" }),
  );
}

afterEach(() => installCaches(undefined));

describe("Cache storage reads", () => {
  test("lists every cache with its count and never creates one", async () => {
    const { storage, domain } = setup();
    variants(storage.add("api-v1"));
    storage.add("empty");
    const catalog = await domain.catalog();
    expect(catalog).toEqual({
      origin: PAGE,
      available: true,
      caches: [
        { name: "api-v1", count: 2, fingerprint: expect.any(String) },
        { name: "empty", count: 0, fingerprint: expect.any(String) },
      ],
    });
    expect([...storage.map.keys()]).toEqual(["api-v1", "empty"]);
  });

  test("a page without Cache storage says so instead of failing", async () => {
    installCaches(undefined);
    const domain = new CacheStorageDomain(pageClient({ [PAGE]: fakeOrigin() }));
    expect(await domain.catalog()).toEqual({ origin: PAGE, available: false, caches: [] });
  });

  test("Vary variants of one address are two entries with their own ids", async () => {
    const { storage, domain } = setup();
    variants(storage.add("api-v1"));
    const page = await domain.entries(PAGE, "api-v1");
    expect(page.total).toBe(2);
    expect(page.described).toBe(2);
    const [fr, en] = page.entries;
    expect(fr?.id).not.toBe(en?.id);
    expect(fr?.url).toBe(API);
    expect(fr?.response).toMatchObject({
      status: 200,
      type: "default",
      size: JSON.stringify({ lang: "fr" }).length,
    });
    expect(fr?.response?.headers).toEqual({
      "content-type": "application/json",
      date: "Thu, 05 Nov 2026 10:00:00 GMT",
      vary: "accept-language",
    });
  });

  test("a cache that is gone is said, and is not created by the read", async () => {
    const { storage, domain } = setup();
    await expect(domain.entries(PAGE, "missing")).rejects.toBeInstanceOf(CacheStorageGoneError);
    expect(storage.map.has("missing")).toBe(false);
  });

  test("an entry reads its headers and body; text as text, a picture as Base64", async () => {
    const { storage, domain } = setup();
    const cache = storage.add("assets");
    cache.put(
      new Request(`${PAGE}/app.css`),
      new Response("body{}", { headers: { "content-type": "text/css" } }),
    );
    cache.put(
      new Request(`${PAGE}/logo.png`),
      new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } }),
    );
    const [css, png] = (await domain.entries(PAGE, "assets")).entries;
    const style = await domain.entry(PAGE, "assets", css?.id ?? "");
    expect(style.body).toEqual({ body: "body{}", base64Encoded: false, read: 6 });
    expect(style.response.headers["content-type"]).toBe("text/css");
    const logo = await domain.entry(PAGE, "assets", png?.id ?? "");
    expect(logo.body).toEqual({ body: "iVBORw==", base64Encoded: true, read: 4 });
    expect(logo.response.size).toBe(4);
  });

  test("a large body is read up to the cap, and its full size is kept", async () => {
    const { storage, domain } = setup();
    storage
      .add("big")
      .put(
        new Request(`${PAGE}/log.txt`),
        new Response("x".repeat(5000), { headers: { "content-type": "text/plain" } }),
      );
    const [entry] = (await domain.entries(PAGE, "big")).entries;
    const detail = await domain.entry(PAGE, "big", entry?.id ?? "", 1000);
    expect(detail.body?.read).toBe(1000);
    expect(detail.body?.body.length).toBe(1000);
    expect(detail.response.size).toBe(5000);
  });

  test("an opaque response has no body or size to show", async () => {
    const { storage, domain } = setup();
    storage.add("cdn").put(new Request("https://cdn.test/font.woff2"), opaqueResponse());
    const [entry] = (await domain.entries(PAGE, "cdn")).entries;
    expect(entry?.response).toMatchObject({ type: "opaque", status: 0, size: null });
    const detail = await domain.entry(PAGE, "cdn", entry?.id ?? "");
    expect(detail.body).toBeNull();
  });
});

describe("Cache storage deletes only what the person saw", () => {
  test("deleting one Vary variant keeps the other", async () => {
    const { storage, domain } = setup();
    const cache = storage.add("api-v1");
    variants(cache);
    const [fr] = (await domain.entries(PAGE, "api-v1")).entries;
    const result = await domain.deleteEntries(PAGE, "api-v1", [
      { id: fr?.id ?? "", version: fr?.version ?? "" },
    ]);
    expect(result).toMatchObject({
      deleted: [fr?.id],
      gone: [],
      changed: [],
      shared: [],
      extra: 0,
    });
    expect(cache.urls).toEqual([`${API} accept-language:en`]);
  });

  test("an entry the app replaced after the read is kept until the person agrees", async () => {
    const { storage, domain } = setup();
    const cache = storage.add("api-v1");
    cache.put(new Request(API), json({ v: 1 }));
    const [entry] = (await domain.entries(PAGE, "api-v1")).entries;
    cache.put(new Request(API), json({ v: 2 }, { date: "Fri, 06 Nov 2026 08:00:00 GMT" }));
    const target = { id: entry?.id ?? "", version: entry?.version ?? "" };
    const kept = await domain.deleteEntries(PAGE, "api-v1", [target]);
    expect(kept).toMatchObject({ deleted: [], gone: [], changed: [target.id] });
    expect(cache.urls).toHaveLength(1);
    const forced = await domain.deleteEntries(PAGE, "api-v1", [target], true);
    expect(forced.deleted).toEqual([target.id]);
    expect(cache.urls).toHaveLength(0);
  });

  test("an entry already gone is named, and a gone cache is not created again", async () => {
    const { storage, domain } = setup();
    const cache = storage.add("api-v1");
    cache.put(new Request(API), json({}));
    const [entry] = (await domain.entries(PAGE, "api-v1")).entries;
    const target = { id: entry?.id ?? "", version: entry?.version ?? "" };
    await cache.delete(new Request(API));
    expect(await domain.deleteEntries(PAGE, "api-v1", [target])).toMatchObject({
      deleted: [],
      gone: [target.id],
      changed: [],
    });
    storage.map.delete("api-v1");
    await expect(domain.deleteEntries(PAGE, "api-v1", [target])).rejects.toBeInstanceOf(
      CacheStorageGoneError,
    );
    expect(storage.map.has("api-v1")).toBe(false);
  });

  test("a cache that gained entries since the read is kept until the person agrees", async () => {
    const { storage, domain } = setup();
    const cache = storage.add("runtime");
    cache.put(new Request(API), json({}));
    cache.put(new Request(`${API}/2`), json({}));
    const refused = await domain
      .deleteCache(PAGE, "runtime", { count: 1, fingerprint: null })
      .catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(CacheStorageChangedError);
    expect((refused as CacheStorageChangedError).count).toBe(2);
    expect(storage.map.has("runtime")).toBe(true);
    expect(
      await domain.deleteCache(PAGE, "runtime", { count: 1, fingerprint: null }, true),
    ).toEqual({ gone: false });
    expect(storage.map.has("runtime")).toBe(false);
  });

  test("a cache deleted already is said, and not created to be deleted", async () => {
    const { storage, domain } = setup();
    expect(await domain.deleteCache(PAGE, "old", { count: 3, fingerprint: null })).toEqual({
      gone: true,
    });
    expect(storage.opened).not.toContain("old");
    expect(storage.map.has("old")).toBe(false);
  });

  test("a page that moved to another origin changes nothing", async () => {
    const { storage, domain } = setup();
    const cache = storage.add("api-v1");
    cache.put(new Request(API), json({}));
    const [entry] = (await domain.entries(PAGE, "api-v1")).entries;
    const other = "https://other.test";
    await expect(
      domain.deleteEntries(other, "api-v1", [{ id: entry?.id ?? "", version: "" }]),
    ).rejects.toBeInstanceOf(CacheStorageWrongOriginError);
    await expect(
      domain.deleteCache(other, "api-v1", { count: 1, fingerprint: null }),
    ).rejects.toBeInstanceOf(CacheStorageWrongOriginError);
    expect(cache.urls).toHaveLength(1);
  });
});

describe("Cache storage deletes check what the read did not see", () => {
  test("an entry without a version is kept unless the person agreed", async () => {
    const { storage, domain } = setup();
    const cache = storage.add("api-v1");
    cache.put(new Request(API), json({ v: 1 }));
    const [entry] = (await domain.entries(PAGE, "api-v1")).entries;
    const result = await domain.deleteEntries(PAGE, "api-v1", [
      { id: entry?.id ?? "", version: "" },
    ]);
    expect(result.deleted).toEqual([]);
    expect(result.changed).toEqual([entry?.id]);
    expect(cache.urls).toHaveLength(1);
  });

  test("the version of an entry the list did not reach is read on its own", async () => {
    const { storage, domain } = setup();
    const cache = storage.add("api-v1");
    cache.put(new Request(API), json({ v: 1 }));
    const [entry] = (await domain.entries(PAGE, "api-v1")).entries;
    const versions = await domain.versions(PAGE, "api-v1", [entry?.id ?? "", "GET gone 0"]);
    expect(versions).toEqual({ [entry?.id ?? ""]: entry?.version });
  });

  test("a new body under the same headers is a change", async () => {
    const { storage, domain } = setup();
    const cache = storage.add("api-v1");
    cache.put(new Request(API), json({ v: 1 }));
    const [entry] = (await domain.entries(PAGE, "api-v1")).entries;
    cache.put(new Request(API), json({ v: 2 }));
    const target = { id: entry?.id ?? "", version: entry?.version ?? "" };
    expect((await domain.deleteEntries(PAGE, "api-v1", [target])).changed).toEqual([target.id]);
    expect(cache.urls).toHaveLength(1);
  });

  test("one entry that fails does not stop the others, and is named", async () => {
    const { storage, domain } = setup();
    const cache = storage.add("api-v1");
    cache.put(new Request(`${API}/1`), json({}));
    cache.put(new Request(`${API}/2`), json({}));
    const [first, second] = (await domain.entries(PAGE, "api-v1")).entries;
    cache.broken.add(`${API}/1`);
    const result = await domain.deleteEntries(PAGE, "api-v1", [
      { id: first?.id ?? "", version: first?.version ?? "" },
      { id: second?.id ?? "", version: second?.version ?? "" },
    ]);
    expect(result.deleted).toEqual([second?.id]);
    expect(result.failed).toEqual([{ id: first?.id, error: "The response could not be read" }]);
  });

  test("an entry whose delete would also remove an entry not asked about is kept", async () => {
    const { storage, domain } = setup();
    const cache = storage.add("api-v1");
    cache.put(
      new Request(API, { headers: { "x-user": "1", "accept-language": "fr" } }),
      json({ user: 1 }, { vary: "x-user" }),
    );
    cache.put(
      new Request(API, { headers: { "x-user": "2", "accept-language": "fr" } }),
      json({ user: 2 }, { vary: "accept-language" }),
    );
    const [one, two] = (await domain.entries(PAGE, "api-v1")).entries;
    cache.varyAware = true;
    const result = await domain.deleteEntries(PAGE, "api-v1", [
      { id: one?.id ?? "", version: one?.version ?? "" },
    ]);
    expect(result.deleted).toEqual([]);
    expect(result.shared).toEqual([one?.id]);
    expect(cache.urls).toHaveLength(2);
    const both = await domain.deleteEntries(PAGE, "api-v1", [
      { id: one?.id ?? "", version: one?.version ?? "" },
      { id: two?.id ?? "", version: two?.version ?? "" },
    ]);
    expect([...both.deleted].sort()).toEqual([one?.id, two?.id].sort());
    expect(cache.urls).toHaveLength(0);
  });

  test("a cache whose entries were swapped for others of the same count is kept", async () => {
    const { storage, domain } = setup();
    const cache = storage.add("runtime");
    cache.put(new Request(`${API}/1`), json({}));
    const seen = (await domain.catalog()).caches[0];
    await cache.delete(new Request(`${API}/1`));
    cache.put(new Request(`${API}/2`), json({}));
    const refused = await domain
      .deleteCache(PAGE, "runtime", {
        count: seen?.count ?? 0,
        fingerprint: seen?.fingerprint ?? "",
      })
      .catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(CacheStorageChangedError);
    expect(storage.map.has("runtime")).toBe(true);
  });
});
