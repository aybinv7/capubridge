import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { Observation } from "@/types/automation.types";
import { evaluateAssertion } from "../assertions";
import type { EvidenceReaders } from "../assertions";

function observation(): Observation {
  return {
    native: {
      controls: [],
      packageName: "com.example.app",
      activity: "MainActivity",
      systemUi: { keyboardVisible: false, dialogPresent: false },
    },
    webview: null,
    signals: { pendingRequests: 0, recentErrors: [], lastDbWrite: null },
    visual: { screenshotRef: "" },
  };
}

function readers(overrides: Partial<EvidenceReaders> = {}): EvidenceReaders {
  return {
    observe: () => Promise.resolve(observation()),
    queryDom: () => Promise.resolve(null),
    currentUrl: () => Promise.resolve("https://example.com/cart"),
    dbRow: () => Promise.resolve(null),
    recentNetwork: () => Promise.resolve([]),
    recentConsole: () => Promise.resolve([]),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function run<Awaited>(pending: Promise<Awaited>, advanceMs = 5000): Promise<Awaited> {
  const assertion = pending.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(advanceMs);
  const settled = await assertion;
  if (!settled.ok) {
    throw settled.error;
  }
  return settled.value;
}

describe("evaluateAssertion", () => {
  test("visible passes immediately with one attempt", async () => {
    const result = await run(
      evaluateAssertion(
        { kind: "visible", target: { kind: "selector", cssSelector: ".cart" }, source: "dom" },
        readers({ queryDom: () => Promise.resolve({ text: "Cart", visible: true }) }),
        { timeoutMs: 1000, pollMs: 100 },
      ),
    );
    expect(result.passed).toBe(true);
    expect(result.attempts).toBe(1);
  });

  test("visible passes on the third poll and elapsedMs reflects the wait", async () => {
    let calls = 0;
    const result = await run(
      evaluateAssertion(
        { kind: "visible", target: { kind: "selector", cssSelector: ".cart" }, source: "dom" },
        readers({
          queryDom: () => {
            calls += 1;
            return Promise.resolve(calls >= 3 ? { text: "Cart", visible: true } : null);
          },
        }),
        { timeoutMs: 1000, pollMs: 100 },
      ),
    );
    expect(result.passed).toBe(true);
    expect(result.attempts).toBe(3);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(200);
  });

  test("visible fails at the timeout describing the absence", async () => {
    const result = await run(
      evaluateAssertion(
        { kind: "visible", target: { kind: "selector", cssSelector: ".cart" }, source: "dom" },
        readers(),
        { timeoutMs: 300, pollMs: 100 },
      ),
    );
    expect(result.passed).toBe(false);
    expect(result.attempts).toBeGreaterThan(1);
    expect(result.observed).toContain(".cart");
  });

  test("notVisible passes on absence but errors on a failed read", async () => {
    const absent = await run(
      evaluateAssertion(
        { kind: "notVisible", target: { kind: "selector", cssSelector: ".cart" }, source: "dom" },
        readers(),
        { timeoutMs: 300, pollMs: 100 },
      ),
    );
    expect(absent.passed).toBe(true);

    const broken = await run(
      evaluateAssertion(
        { kind: "notVisible", target: { kind: "selector", cssSelector: ".cart" }, source: "dom" },
        readers({ queryDom: () => Promise.reject(new Error("cdp detached")) }),
        { timeoutMs: 300, pollMs: 100 },
      ),
    );
    expect(broken.passed).toBe(false);
    expect(broken.observed).toContain("error");
  });

  test("textEquals failure carries expected and observed text", async () => {
    const result = await run(
      evaluateAssertion(
        {
          kind: "textEquals",
          target: { kind: "selector", cssSelector: ".total" },
          expected: "Total: 3 items",
        },
        readers({ queryDom: () => Promise.resolve({ text: "Total: 0 items", visible: true }) }),
        { timeoutMs: 200, pollMs: 100 },
      ),
    );
    expect(result.passed).toBe(false);
    expect(result.observed).toContain("Total: 3 items");
    expect(result.observed).toContain("Total: 0 items");
  });

  test("textContains is substring-based and case-sensitive", async () => {
    const result = await run(
      evaluateAssertion(
        {
          kind: "textContains",
          target: { kind: "selector", cssSelector: ".total" },
          substring: "total:",
        },
        readers({ queryDom: () => Promise.resolve({ text: "Total: 3 items", visible: true }) }),
        { timeoutMs: 200, pollMs: 100 },
      ),
    );
    expect(result.passed).toBe(false);
  });

  test("urlMatches passes on a regex match and fails with the observed URL", async () => {
    const passing = await run(
      evaluateAssertion({ kind: "urlMatches", pattern: "^https://example\\.com/cart" }, readers(), {
        timeoutMs: 200,
        pollMs: 100,
      }),
    );
    expect(passing.passed).toBe(true);

    const failing = await run(
      evaluateAssertion(
        { kind: "urlMatches", pattern: "^https://example\\.com/checkout" },
        readers(),
        { timeoutMs: 200, pollMs: 100 },
      ),
    );
    expect(failing.passed).toBe(false);
    expect(failing.observed).toContain("https://example.com/cart");
  });

  test("dbRowExists passes on a row and fails on null", async () => {
    const passing = await run(
      evaluateAssertion(
        { kind: "dbRowExists", database: "shop", store: "cart", key: "item-1" },
        readers({ dbRow: () => Promise.resolve({ id: "item-1" }) }),
        { timeoutMs: 200, pollMs: 100 },
      ),
    );
    expect(passing.passed).toBe(true);

    const failing = await run(
      evaluateAssertion(
        { kind: "dbRowExists", database: "shop", store: "cart", key: "item-9" },
        readers(),
        { timeoutMs: 200, pollMs: 100 },
      ),
    );
    expect(failing.passed).toBe(false);
    expect(failing.observed).toContain("item-9");
  });

  test("networkStatus passes on the expected status and reports statuses seen", async () => {
    const base = {
      recentNetwork: () =>
        Promise.resolve([
          { url: "https://api.example.com/cart", method: "POST", status: 200 },
          { url: "https://api.example.com/cart", method: "POST", status: 500 },
        ]),
    };
    const passing = await run(
      evaluateAssertion(
        { kind: "networkStatus", urlPattern: "/cart", status: 200, method: "POST" },
        readers(base),
        { timeoutMs: 200, pollMs: 100 },
      ),
    );
    expect(passing.passed).toBe(true);

    const failing = await run(
      evaluateAssertion(
        { kind: "networkStatus", urlPattern: "/cart", status: 201, method: "POST" },
        readers(base),
        { timeoutMs: 200, pollMs: 100 },
      ),
    );
    expect(failing.passed).toBe(false);
    expect(failing.observed).toContain("200");
    expect(failing.observed).toContain("500");
  });

  test("consoleClean respects the threshold and ignore patterns", async () => {
    const quiet = await run(
      evaluateAssertion(
        { kind: "consoleClean", level: "error" },
        readers({ recentConsole: () => Promise.resolve([{ level: "info", text: "ready" }]) }),
        { timeoutMs: 200, pollMs: 100 },
      ),
    );
    expect(quiet.passed).toBe(true);

    const noisy = await run(
      evaluateAssertion(
        { kind: "consoleClean", level: "error" },
        readers({ recentConsole: () => Promise.resolve([{ level: "error", text: "boom" }]) }),
        { timeoutMs: 200, pollMs: 100 },
      ),
    );
    expect(noisy.passed).toBe(false);
    expect(noisy.observed).toContain("boom");

    const ignored = await run(
      evaluateAssertion(
        { kind: "consoleClean", level: "error", ignorePatterns: ["known-noisy"] },
        readers({
          recentConsole: () =>
            Promise.resolve([{ level: "error", text: "known-noisy widget warning" }]),
        }),
        { timeoutMs: 200, pollMs: 100 },
      ),
    );
    expect(ignored.passed).toBe(true);
  });

  test("assertions never consult a policy", async () => {
    const source = await readFile(new URL("../assertions.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/policies\//);
    expect(source).not.toContain("AgentPolicy");
  });
});
