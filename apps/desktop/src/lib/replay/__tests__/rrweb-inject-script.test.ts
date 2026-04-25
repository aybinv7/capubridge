import { describe, test, expect } from "vite-plus/test";
import { buildInjectionScript } from "../rrweb-inject-script";

describe("buildInjectionScript", () => {
  test("returns a non-empty string", () => {
    const script = buildInjectionScript();
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(100);
  });

  test("includes __capuEmit binding call", () => {
    const script = buildInjectionScript();
    expect(script).toContain("__capuEmit");
  });

  test("includes pushState interception for SPA routes", () => {
    const script = buildInjectionScript();
    expect(script).toContain("pushState");
  });

  test("includes batching setTimeout", () => {
    const script = buildInjectionScript();
    expect(script).toContain("setTimeout");
  });
});
