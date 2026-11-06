import { describe, expect, test } from "vite-plus/test";
import {
  KeyValueConflictError,
  KeyValueDomain,
  KeyValueWrongOriginError,
} from "../src/cdp/domains/keyvalue.ts";
import { FRAME, PAGE, fakeOrigin, pageClient } from "./keyvalue-fixture.ts";

const local = { origin: PAGE, kind: "area", area: "local" } as const;

describe("Local storage writes keep what the person did not see", () => {
  test("a save writes the text exactly as typed, minified JSON stays minified", async () => {
    const page = fakeOrigin({ prefs: '{"a":1}' });
    const domain = new KeyValueDomain(pageClient({ [PAGE]: page }));
    await domain.write(local, {
      op: "set",
      key: "prefs",
      value: '{"a":2,"b":[1,2]}',
      expected: '{"a":1}',
    });
    expect(page.local.getItem("prefs")).toBe('{"a":2,"b":[1,2]}');
  });

  test("a new key that already exists is refused, then replaced only when asked", async () => {
    const page = fakeOrigin({ token: "old" });
    const domain = new KeyValueDomain(pageClient({ [PAGE]: page }));
    const create = { op: "set", key: "token", value: "new", expected: null } as const;
    const refused = await domain.write(local, create).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(KeyValueConflictError);
    expect((refused as KeyValueConflictError).conflict).toBe("exists");
    expect(page.local.getItem("token")).toBe("old");
    await domain.write(local, { ...create, replaceExisting: true });
    expect(page.local.getItem("token")).toBe("new");
  });

  test("a rename onto a taken key changes nothing until the person agrees", async () => {
    const page = fakeOrigin({ a: "1", b: "2" });
    const domain = new KeyValueDomain(pageClient({ [PAGE]: page }));
    const rename = { op: "rename", key: "a", nextKey: "b", value: "1", expected: "1" } as const;
    await expect(domain.write(local, rename)).rejects.toMatchObject({ conflict: "exists" });
    expect(page.local.toObject()).toEqual({ a: "1", b: "2" });
    await domain.write(local, { ...rename, replaceExisting: true });
    expect(page.local.toObject()).toEqual({ b: "1" });
  });

  test("a rename moves the value and removes the old key in one step", async () => {
    const page = fakeOrigin({ a: "1" });
    await new KeyValueDomain(pageClient({ [PAGE]: page })).write(local, {
      op: "rename",
      key: "a",
      nextKey: "c",
      value: "2",
      expected: "1",
    });
    expect(page.local.toObject()).toEqual({ c: "2" });
  });

  test("a value the app changed after the read is not overwritten silently", async () => {
    const page = fakeOrigin({ cart: "app wrote this" });
    const domain = new KeyValueDomain(pageClient({ [PAGE]: page }));
    const save = { op: "set", key: "cart", value: "mine", expected: "what I saw" } as const;
    await expect(domain.write(local, save)).rejects.toMatchObject({ conflict: "changed" });
    expect(page.local.getItem("cart")).toBe("app wrote this");
    await domain.write(local, { ...save, overwriteChanged: true });
    expect(page.local.getItem("cart")).toBe("mine");
  });

  test("a value the app deleted after the read is not created again silently", async () => {
    const page = fakeOrigin();
    const domain = new KeyValueDomain(pageClient({ [PAGE]: page }));
    const save = { op: "set", key: "gone", value: "x", expected: "y" } as const;
    await expect(domain.write(local, save)).rejects.toMatchObject({ conflict: "gone" });
    expect(page.local.getItem("gone")).toBeNull();
  });

  test("a delete of a key that is already gone says so", async () => {
    const domain = new KeyValueDomain(pageClient({ [PAGE]: fakeOrigin() }));
    await expect(domain.write(local, { op: "delete", key: "x" })).resolves.toEqual({ gone: true });
  });

  test("a full phone leaves a rename untouched", async () => {
    const page = fakeOrigin({ a: "1" });
    page.local.quotaBytes = 4;
    const domain = new KeyValueDomain(pageClient({ [PAGE]: page }));
    await expect(
      domain.write(local, {
        op: "rename",
        key: "a",
        nextKey: "longer",
        value: "1",
        expected: "1",
      }),
    ).rejects.toThrow(/no room left/);
    expect(page.local.toObject()).toEqual({ a: "1" });
  });

  test("session storage writes never touch local storage", async () => {
    const page = fakeOrigin({ k: "local" }, { k: "session" });
    await new KeyValueDomain(pageClient({ [PAGE]: page })).write(
      { kind: "area", origin: PAGE, area: "session" },
      { op: "set", key: "k", value: "new", expected: "session" },
    );
    expect(page.session.getItem("k")).toBe("new");
    expect(page.local.getItem("k")).toBe("local");
  });
});

describe("writes land in the origin they were read from", () => {
  const frames = [
    { id: "main", origin: PAGE },
    { id: "child", origin: FRAME },
  ];

  test("a frame's storage is written in that frame, not in the page", async () => {
    const page = fakeOrigin({ k: "page" });
    const frame = fakeOrigin({ k: "frame" });
    const client = pageClient({ [PAGE]: page, [FRAME]: frame }, frames);
    await new KeyValueDomain(client).write(
      { kind: "area", origin: FRAME, area: "local" },
      { op: "set", key: "k", value: "new", expected: "frame" },
    );
    expect(client.calls).toContain("Page.createIsolatedWorld");
    expect(frame.local.getItem("k")).toBe("new");
    expect(page.local.getItem("k")).toBe("page");
  });

  test("an origin no frame has any more is refused", async () => {
    const page = fakeOrigin({ k: "page" });
    const domain = new KeyValueDomain(pageClient({ [PAGE]: page }));
    await expect(
      domain.write(
        { kind: "area", origin: "https://gone.test", area: "local" },
        { op: "delete", key: "k" },
      ),
    ).rejects.toBeInstanceOf(KeyValueWrongOriginError);
    expect(page.local.getItem("k")).toBe("page");
  });
});

describe("reads", () => {
  test("a frame's storage is read where it is written, not in another partition", async () => {
    const frame = fakeOrigin({ k: "the frame's own" });
    const unpartitioned = fakeOrigin({ k: "another partition" });
    const client = pageClient(
      { [PAGE]: fakeOrigin(), [FRAME]: frame },
      [
        { id: "main", origin: PAGE },
        { id: "child", origin: FRAME },
      ],
      { domStorage: { [FRAME]: unpartitioned } },
    );
    const domain = new KeyValueDomain(client);
    expect(await domain.readArea(FRAME, "local")).toEqual([{ key: "k", value: "the frame's own" }]);
    expect(client.calls).not.toContain("DOMStorage.enable");
  });

  test("discovery leaves DOMStorage alone", async () => {
    const client = pageClient({ [PAGE]: fakeOrigin({ a: "1" }) });
    await new KeyValueDomain(client).discover();
    expect(client.calls).not.toContain("DOMStorage.enable");
  });

  test("lists the page origin first, then its frames, with the page's counts", async () => {
    const client = pageClient({ [PAGE]: fakeOrigin({ a: "1", b: "2" }, { s: "1" }) }, [
      { id: "main", origin: PAGE },
      { id: "blank", origin: "://" },
      { id: "child", origin: FRAME },
    ]);
    const found = await new KeyValueDomain(client).discover();
    expect(found.pageOrigin).toBe(PAGE);
    expect(found.origins).toEqual([PAGE, FRAME]);
    expect(found.counts).toEqual({ local: 2, session: 1 });
  });

  test("reads Local and Session storage apart, values as stored", async () => {
    const domain = new KeyValueDomain(
      pageClient({ [PAGE]: fakeOrigin({ a: '{"x":1}' }, { b: "two" }) }),
    );
    expect(await domain.readArea(PAGE, "local")).toEqual([{ key: "a", value: '{"x":1}' }]);
    expect(await domain.readArea(PAGE, "session")).toEqual([{ key: "b", value: "two" }]);
  });
});

describe("deletes keep what the person did not see", () => {
  test("a key the app changed after the read is kept until the person agrees", async () => {
    const page = fakeOrigin({ cart: "app wrote this" });
    const domain = new KeyValueDomain(pageClient({ [PAGE]: page }));
    const remove = { op: "delete", key: "cart", expected: "what I saw" } as const;
    await expect(domain.write(local, remove)).rejects.toMatchObject({ conflict: "changed" });
    expect(page.local.getItem("cart")).toBe("app wrote this");
    await domain.write(local, { ...remove, overwriteChanged: true });
    expect(page.local.getItem("cart")).toBeNull();
  });

  test("a batch deletes what is unchanged, names what changed or went, in one frame lookup", async () => {
    const page = fakeOrigin({ a: "1", b: "app", c: "3" });
    const frame = fakeOrigin({ a: "1", b: "2", c: "3" });
    const client = pageClient({ [PAGE]: page, [FRAME]: frame }, [
      { id: "main", origin: PAGE },
      { id: "child", origin: FRAME },
    ]);
    frame.local.setItem("b", "app");
    const progress: number[] = [];
    const result = await new KeyValueDomain(client).deleteMany(
      { kind: "area", origin: FRAME, area: "local" },
      [
        { key: "a", expected: "1" },
        { key: "b", expected: "2" },
        { key: "gone", expected: "x" },
        { key: "c", expected: "3" },
      ],
      { onProgress: (done) => progress.push(done) },
    );
    expect(result).toEqual({ deleted: [0, 3], changed: [1], gone: [2] });
    expect(frame.local.toObject()).toEqual({ b: "app" });
    expect(page.local.toObject()).toEqual({ a: "1", b: "app", c: "3" });
    expect(client.calls.filter((call) => call === "Page.createIsolatedWorld")).toHaveLength(1);
    expect(progress.at(-1)).toBe(4);
  });

  test("a forced batch deletes the changed keys too", async () => {
    const page = fakeOrigin({ b: "app" });
    const result = await new KeyValueDomain(pageClient({ [PAGE]: page })).deleteMany(
      local,
      [{ key: "b", expected: "2" }],
      { force: true },
    );
    expect(result.deleted).toEqual([0]);
    expect(page.local.toObject()).toEqual({});
  });
});
