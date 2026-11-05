import { describe, expect, test } from "vite-plus/test";
import type { MockRule } from "@/types/mock.types";
import { matchUrl } from "../stores/useMockStore";
import { applyDraft, draftFromRule, sameEditorFields } from "../mock/mockDraft";
import {
  mockAvailability,
  mockRuleFromRequest,
  mockRuleNotes,
  patternForUrl,
  prettyBody,
} from "../mock/mockFromRequest";
import {
  clampInteger,
  logOutcome,
  matchesRuleSearch,
  rulesSummary,
  scopeWords,
} from "../mock/mockView";
import { networkEntry } from "./fixtures";

function rule(overrides: Partial<MockRule> = {}): MockRule {
  return {
    id: "rule",
    name: "Orders",
    enabled: true,
    method: "GET",
    urlPattern: "/orders",
    urlMatchType: "contains",
    statusCode: 200,
    contentType: "application/json",
    responseHeaders: [],
    responseBody: '{"a":1}',
    delayMs: 0,
    passThrough: false,
    createdAt: 1,
    ...overrides,
  };
}

describe("mock this response", () => {
  test("a URL without a query is matched exactly, with one by path and any query", () => {
    expect(patternForUrl("https://api.test/orders")).toEqual({
      urlPattern: "https://api.test/orders",
      urlMatchType: "exact",
    });
    const glob = patternForUrl("https://api.test/orders?page=2");
    expect(glob).toEqual({ urlPattern: "https://api.test/orders?", urlMatchType: "contains" });
    expect(matchUrl(glob.urlPattern, glob.urlMatchType, "https://api.test/orders?page=9")).toBe(
      true,
    );
    expect(matchUrl(glob.urlPattern, glob.urlMatchType, "https://api.test/orders/5?page=9")).toBe(
      false,
    );
  });

  test("the rule answers like the request was answered", () => {
    const entry = networkEntry({
      url: "https://api.test/orders",
      method: "post",
      httpStatus: 201,
      responseHeaders: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": "7",
        "Cache-Control": "no-store",
        "Set-Cookie": "a=1\nb=2",
      },
    });
    const draft = mockRuleFromRequest(entry, {
      body: '{"id":12345678901234567890,"v":1.0}',
      base64Encoded: false,
    });

    expect(draft).toMatchObject({
      name: "/orders",
      method: "POST",
      statusCode: 201,
      contentType: "application/json; charset=utf-8",
      responseBody: '{"id":12345678901234567890,"v":1.0}',
      enabled: true,
      passThrough: false,
    });
    expect(draft.responseHeaders?.map(({ name, value }) => [name, value])).toEqual([
      ["Cache-Control", "no-store"],
      ["Set-Cookie", "a=1"],
      ["Set-Cookie", "b=2"],
    ]);
  });

  test("unusual methods and missing statuses fall back safely", () => {
    const draft = mockRuleFromRequest(
      networkEntry({ method: "PROPFIND", httpStatus: null, mimeType: "" }),
      null,
    );
    expect(draft.method).toBe("ANY");
    expect(draft.statusCode).toBe(200);
    expect(draft.responseBody).toBe("");
  });

  test("a query that carries the real address is kept, so one rule does not answer every call", () => {
    const capacitor =
      "https://localhost/_capacitor_http_interceptor_?u=https%3A%2F%2Fapi.test%2Forders%3Fp%3D1";
    expect(patternForUrl(capacitor)).toEqual({ urlPattern: capacitor, urlMatchType: "exact" });
    const proxied = "https://proxy.test/fetch?target=https://api.test/a";
    expect(patternForUrl(proxied).urlMatchType).toBe("exact");
  });

  test("redirects and not-modified answers replay as 200, with a note", () => {
    const entry = networkEntry({ httpStatus: 304 });
    const draft = mockRuleFromRequest(entry, null);
    expect(draft.statusCode).toBe(200);
    expect(mockRuleNotes(entry, draft)).toContain("The original 304 is answered as 200.");
  });

  test("a request that sent a body warns that the rule ignores it", () => {
    const entry = networkEntry({
      method: "POST",
      hasPostData: true,
      url: "https://odoo.test/jsonrpc",
    });
    expect(mockRuleNotes(entry, mockRuleFromRequest(entry, null))[0]).toMatch(/every POST/);
  });

  test("binary bodies are kept as Base64", () => {
    const draft = mockRuleFromRequest(networkEntry({ mimeType: "application/pdf" }), {
      body: "JVBERi0=",
      base64Encoded: true,
    });
    expect(draft).toMatchObject({ responseBody: "JVBERi0=", bodyEncoding: "base64" });
  });

  test("only requests interception can answer are offered", () => {
    expect(mockAvailability(networkEntry()).ok).toBe(true);
    expect(mockAvailability(networkEntry({ resourceType: "Image" })).ok).toBe(false);
    expect(mockAvailability(networkEntry({ state: "pending" })).ok).toBe(false);
    expect(mockAvailability(networkEntry({ isWebSocket: true })).ok).toBe(false);
  });

  test("only JSON bodies are pretty-printed", () => {
    expect(prettyBody('{"a":1}', "text/plain")).toBe('{"a":1}');
    expect(prettyBody("{bad", "application/json")).toBe("{bad");
  });
});

describe("mock view helpers", () => {
  test("numbers are clamped and fall back when not numbers", () => {
    expect(clampInteger(70000, 1024, 65535, 3001)).toBe(65535);
    expect(clampInteger("abc", 100, 599, 200)).toBe(200);
    expect(clampInteger(201.6, 100, 599, 200)).toBe(202);
  });

  test("log outcomes are named", () => {
    const base = {
      id: "1",
      timestamp: 0,
      method: "GET",
      url: "u",
      matchedRuleId: null,
      matchedRuleName: null,
      responseStatus: null,
      mode: "cdp" as const,
      delayApplied: 0,
      passedThrough: true,
      noMatch: true,
    };
    expect(logOutcome(base)).toBe("unmatched");
    expect(logOutcome({ ...base, noMatch: false })).toBe("passed");
    expect(logOutcome({ ...base, noMatch: false, passedThrough: false })).toBe("mocked");
  });

  test("scope and counts read as sentences", () => {
    expect(scopeWords(null, null).label).toBe("Shared rules");
    expect(
      scopeWords(
        {
          id: "t",
          type: "page",
          title: "Shop",
          url: "https://shop.test",
          source: "adb",
          deviceSerial: "SER",
        },
        "Presalio Retail",
      ),
    ).toEqual({
      label: "Rules for Presalio Retail",
      detail: "Kept for pages of https://shop.test",
    });
    expect(
      scopeWords(
        {
          id: "t",
          type: "page",
          title: "Shop",
          url: "https://localhost",
          source: "adb",
          deviceSerial: "SER",
          packageName: "com.shop",
        },
        "Shop",
      ).detail,
    ).toBe("Kept for com.shop on SER, across restarts");
    expect(rulesSummary(0, 0, "cdp")).toBe("No rules");
    expect(rulesSummary(1, 3, "cdp")).toBe("1 of 3 rules on");
    expect(rulesSummary(1, 1, "off")).toBe("1 rule ready, interception off");
    expect(matchesRuleSearch({ name: "Orders", urlPattern: "/api" }, " ORD ")).toBe(true);
    expect(matchesRuleSearch({ name: "Orders", urlPattern: "/api" }, "users")).toBe(false);
  });
});

describe("rule drafts", () => {
  test("a draft is independent and keeps the body byte for byte", () => {
    const stored = rule({
      responseHeaders: [{ id: "h", name: "X", value: "1" }],
      responseBody: '{"big":12345678901234567890,"f":1.0}',
    });
    const draft = draftFromRule(stored);
    draft.responseHeaders[0]!.value = "changed";

    expect(stored.responseHeaders[0]?.value).toBe("1");
    expect(draft.responseBody).toBe('{"big":12345678901234567890,"f":1.0}');
  });

  test("applying a draft keeps the switch and identity", () => {
    const stored = rule({ enabled: false });
    const updated = applyDraft(stored, { ...draftFromRule(stored), name: "Renamed" });

    expect(updated).toMatchObject({ id: "rule", enabled: false, name: "Renamed" });
  });

  test("editor fields are compared field by field", () => {
    const stored = rule();
    expect(sameEditorFields(stored, { ...stored, enabled: false })).toBe(true);
    expect(sameEditorFields(stored, { ...stored, statusCode: 500 })).toBe(false);
    expect(
      sameEditorFields(stored, {
        ...stored,
        responseHeaders: [{ id: "x", name: "A", value: "1" }],
      }),
    ).toBe(false);
  });
});
