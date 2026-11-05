import { describe, expect, test } from "vite-plus/test";
import type { MockRule } from "@/types/mock.types";
import { matchUrl } from "../stores/useMockStore";
import { applyDraft, draftFromRule, draftSignature } from "../mock/mockDraft";
import { mockRuleFromRequest, patternForUrl, prettyBody } from "../mock/mockFromRequest";
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
    hitCount: 3,
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
    const draft = mockRuleFromRequest(entry, '{"id":1}');

    expect(draft).toMatchObject({
      name: "/orders",
      method: "POST",
      statusCode: 201,
      contentType: "application/json; charset=utf-8",
      responseBody: '{\n  "id": 1\n}',
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
    ).toEqual({ label: "Rules for Presalio Retail", detail: "SER · https://shop.test" });
    expect(rulesSummary(0, 0)).toBe("No rules");
    expect(rulesSummary(1, 3)).toBe("1 of 3 rules on");
    expect(matchesRuleSearch({ name: "Orders", urlPattern: "/api" }, " ORD ")).toBe(true);
    expect(matchesRuleSearch({ name: "Orders", urlPattern: "/api" }, "users")).toBe(false);
  });
});

describe("rule drafts", () => {
  test("a draft is independent and pretty-prints its JSON body", () => {
    const stored = rule({ responseHeaders: [{ id: "h", name: "X", value: "1" }] });
    const draft = draftFromRule(stored);
    draft.responseHeaders[0]!.value = "changed";

    expect(stored.responseHeaders[0]?.value).toBe("1");
    expect(draft.responseBody).toBe('{\n  "a": 1\n}');
  });

  test("applying a draft keeps the switch, hits and identity", () => {
    const stored = rule({ enabled: false, hitCount: 7 });
    const updated = applyDraft(stored, { ...draftFromRule(stored), name: "Renamed" });

    expect(updated).toMatchObject({ id: "rule", enabled: false, hitCount: 7, name: "Renamed" });
  });

  test("signatures change only with editor-owned fields", () => {
    const stored = rule();
    const signature = draftSignature(draftFromRule(stored));
    expect(draftSignature(draftFromRule({ ...stored, hitCount: 99, enabled: false }))).toBe(
      signature,
    );
    expect(draftSignature(draftFromRule({ ...stored, statusCode: 500 }))).not.toBe(signature);
  });
});
