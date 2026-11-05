import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { LEGACY_KEYS, migrateLegacyRules } from "../stores/mockMigration";
import { memoryMockPersistence } from "../stores/mockRulesDb";
import { earlierScopeFor, mockScopeKey } from "../stores/mockScope";
import { setMockPersistenceFactory } from "../stores/useMockPersistence";
import { useMockStore } from "../stores/useMockStore";
import { mockRuleExport, parseMockRuleExport } from "../mockRuleTransfer";
import { createStorage } from "./storage";

vi.mock("vue-sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

const OLD_RULE = {
  id: "5945ab16",
  name: "GET /catalog/manifest.json",
  enabled: true,
  method: "GET",
  urlPattern: "https://localhost/catalog/manifest.json",
  urlMatchType: "exact",
  statusCode: 200,
  contentType: "application/json",
  responseHeaders: [{ id: "h1", name: "Cache-Control", value: "no-store" }],
  responseBody: '{"version":12345678901234567890}',
  delayMs: 0,
  passThrough: false,
  hitCount: 4,
  createdAt: 1730000000000,
};

const OLD_STORAGE: Record<string, string> = {
  [LEGACY_KEYS.configs]: JSON.stringify({
    "adb:r4geda5p7d65u8uo:6CA970441DEFE3319FE2767C89CB7006": {
      rules: [OLD_RULE],
      interceptMode: "cdp",
    },
    "adb:192.168.1.5:5555:AAAA": { rules: [{ ...OLD_RULE, id: "wifi" }], interceptMode: "off" },
    "adb:r4geda5p7d65u8uo:EMPTY": { rules: [], interceptMode: "cdp" },
    global: { rules: [{ ...OLD_RULE, id: "shared" }], interceptMode: "off" },
  }),
  [LEGACY_KEYS.migrated]: "true",
};

const PHONE = { source: "adb" as const, deviceSerial: "r4geda5p7d65u8uo" };
const APP = { ...PHONE, packageName: "com.presalio.retail", url: "https://localhost/" };

describe("moving rules out of localStorage", () => {
  test("page-id scopes wait per device, interception off, hit counts dropped", () => {
    const configs = migrateLegacyRules((key) => OLD_STORAGE[key] ?? null);

    expect(Object.keys(configs).sort()).toEqual([
      "earlier:adb:192.168.1.5:5555",
      "earlier:adb:r4geda5p7d65u8uo",
      "global",
    ]);
    const waiting = configs["earlier:adb:r4geda5p7d65u8uo"];
    expect(waiting?.interceptMode).toBe("off");
    expect(waiting?.rules[0]).toEqual({
      ...Object.fromEntries(Object.entries(OLD_RULE).filter(([key]) => key !== "hitCount")),
      responseBody: '{"version":12345678901234567890}',
    });
  });

  test("the oldest single list is kept when it was never moved", () => {
    const configs = migrateLegacyRules(
      (key) =>
        ({ [LEGACY_KEYS.rules]: JSON.stringify([OLD_RULE]), [LEGACY_KEYS.mode]: '"cdp"' })[key] ??
        null,
    );
    expect(configs.global?.rules.map((rule) => rule.id)).toEqual(["5945ab16"]);
  });

  test("unreadable rules are skipped one by one", () => {
    const configs = migrateLegacyRules(
      (key) =>
        ({
          [LEGACY_KEYS.configs]: JSON.stringify({
            global: { rules: [OLD_RULE, { name: "no id" }, 7], interceptMode: "weird" },
          }),
        })[key] ?? null,
    );
    expect(configs.global?.rules).toHaveLength(1);
    expect(configs.global?.interceptMode).toBe("off");
  });
});

describe("first run with rules in localStorage", () => {
  let persistence: ReturnType<typeof memoryMockPersistence>;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: createStorage(OLD_STORAGE),
    });
    persistence = memoryMockPersistence(null);
    setMockPersistenceFactory(() => persistence);
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("rules move to IndexedDB, localStorage is emptied, and the app claims them", async () => {
    const store = useMockStore();
    await store.ready;

    expect(Object.keys(persistence.saved ?? {})).toContain("earlier:adb:r4geda5p7d65u8uo");
    expect(localStorage.getItem(LEGACY_KEYS.configs)).toBeNull();

    store.setScope(mockScopeKey(APP), earlierScopeFor(APP));
    await vi.advanceTimersByTimeAsync(1000);

    expect(store.currentScope).toBe("app:r4geda5p7d65u8uo:com.presalio.retail");
    expect(store.rules.map((rule) => rule.id)).toEqual(["5945ab16"]);
    expect(store.interceptMode).toBe("off");
    expect(persistence.saved?.["earlier:adb:r4geda5p7d65u8uo"]).toBeUndefined();
    expect(persistence.saved?.["app:r4geda5p7d65u8uo:com.presalio.retail"]?.rules).toHaveLength(1);
  });

  test("a failed first write keeps localStorage as it was", async () => {
    persistence.fail = new Error("quota");
    const store = useMockStore();
    await store.ready;

    expect(localStorage.getItem(LEGACY_KEYS.configs)).toBe(OLD_STORAGE[LEGACY_KEYS.configs] ?? "");
    expect(store.saveError).toBe("quota");
  });

  test("an app restart keeps the rules: the scope no longer depends on the page id", () => {
    expect(mockScopeKey({ ...APP })).toBe(mockScopeKey({ ...APP }));
    expect(mockScopeKey({ source: "local", url: "http://localhost:5173/a" })).toBe(
      "page:local:local:http://localhost:5173",
    );
  });
});

describe("rule files", () => {
  test("an old export (no body encoding, hit counts) imports as text", () => {
    const oldFile = {
      format: "capubridge-mock-rule",
      version: 1,
      exportedAt: "2026-10-01T10:00:00.000Z",
      rule: { ...OLD_RULE, id: undefined, createdAt: undefined },
    };
    const parsed = parseMockRuleExport(JSON.parse(JSON.stringify(oldFile)));
    expect(parsed.bodyEncoding).toBeUndefined();
    expect(parsed.responseBody).toBe('{"version":12345678901234567890}');
    expect(parsed).not.toHaveProperty("hitCount");
  });

  test("export then import keeps every field, binary bodies included", () => {
    const rule = {
      ...OLD_RULE,
      method: "GET" as const,
      urlMatchType: "exact" as const,
      responseBody: "iVBORw0KGgo=",
      bodyEncoding: "base64" as const,
      contentType: "image/png",
    };
    const file = JSON.parse(JSON.stringify(mockRuleExport(rule)));
    const back = parseMockRuleExport(file);

    expect(back).toMatchObject({
      name: rule.name,
      method: "GET",
      urlPattern: rule.urlPattern,
      urlMatchType: "exact",
      statusCode: 200,
      contentType: "image/png",
      responseBody: "iVBORw0KGgo=",
      bodyEncoding: "base64",
      delayMs: 0,
      passThrough: false,
    });
    expect(back.responseHeaders?.map(({ name, value }) => [name, value])).toEqual([
      ["Cache-Control", "no-store"],
    ]);
  });
});
