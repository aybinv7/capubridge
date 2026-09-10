import { describe, test, expect, vi } from "vite-plus/test";
import { runInNewContext } from "node:vm";
import { buildInjectionScript, buildRecorderBootstrap } from "../rrweb-inject-script";

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

  test("stops once, restores hooks, and can start again", () => {
    const listeners = new Map<string, EventListener>();
    const originalPush = () => undefined;
    const originalReplace = () => undefined;
    const history = { pushState: originalPush, replaceState: originalReplace };
    const recorderStops: Array<ReturnType<typeof vi.fn>> = [];
    const rrweb = {
      record: () => {
        const stop = vi.fn();
        recorderStops.push(stop);
        return stop;
      },
      addCustomEvent: vi.fn(),
    };
    const window = {
      location: { href: "https://example.test" },
      addEventListener: (name: string, handler: EventListener) => listeners.set(name, handler),
      removeEventListener: (name: string) => listeners.delete(name),
    } as unknown as Window & Record<string, unknown>;
    const run = () =>
      runInNewContext(buildRecorderBootstrap(), {
        window,
        history,
        rrweb,
        setTimeout,
        clearTimeout,
      });

    run();
    expect(window.__capuRrwebStarted).toBe(true);
    expect(history.pushState).not.toBe(originalPush);
    window.location.href = "https://example.test/next";
    history.pushState();
    expect(rrweb.addCustomEvent).toHaveBeenCalledWith("capu:route-change", {
      url: "https://example.test/next",
    });
    run();
    expect(recorderStops).toHaveLength(1);

    const stop = window.__capuStopRrweb as () => { stopped: boolean; alreadyStopped?: boolean };
    expect(stop().stopped).toBe(true);
    expect(stop().alreadyStopped).toBe(true);
    expect(recorderStops[0]).toHaveBeenCalledTimes(1);
    expect(history.pushState).toBe(originalPush);
    expect(history.replaceState).toBe(originalReplace);
    expect(listeners.has("popstate")).toBe(false);
    expect(window.__capuRrwebStarted).toBe(false);

    run();
    expect(recorderStops).toHaveLength(2);
  });

  test("clears startup state when rrweb is unavailable", () => {
    const window = {
      location: { href: "https://example.test" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window & Record<string, unknown>;
    runInNewContext(buildRecorderBootstrap(), {
      window,
      history: { pushState: vi.fn(), replaceState: vi.fn() },
    });
    expect(window.__capuRrwebStarted).toBe(false);
  });

  test("bounds events while binding is unavailable and reports truncation", () => {
    vi.useFakeTimers();
    let emit: ((event: unknown) => void) | undefined;
    const rrweb = {
      record: (options: { emit: (event: unknown) => void }) => {
        emit = options.emit;
        return vi.fn();
      },
      addCustomEvent: vi.fn(),
    };
    const window = {
      location: { href: "https://example.test" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window & Record<string, unknown>;
    const history = { pushState: vi.fn(), replaceState: vi.fn() };
    runInNewContext(buildRecorderBootstrap(), {
      window,
      history,
      rrweb,
      setTimeout,
      clearTimeout,
    });

    for (let index = 0; index < 700; index += 1) emit?.({ index });
    const stop = window.__capuStopRrweb as () => { truncated: boolean };
    expect(stop().truncated).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
