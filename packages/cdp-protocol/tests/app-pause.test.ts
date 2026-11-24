import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vite-plus/test";
import type { CDPClient } from "../src/cdp/client.ts";
import { AppPause, AppPauseError } from "../src/cdp/domains/app-pause.ts";
import { FakeStorage } from "./keyvalue-fixture.ts";

const ORIGIN = "https://localhost";

interface FakeWindow {
  top?: FakeWindow;
  stopped: boolean;
  Worker: unknown;
  SharedWorker: unknown;
  __capubridgePaused?: string;
  stop(): void;
}

function newWindow(): FakeWindow {
  const win: FakeWindow = {
    stopped: false,
    Worker: function NativeWorker() {},
    SharedWorker: function NativeSharedWorker() {},
    stop() {
      win.stopped = true;
    },
  };
  win.top = win;
  return win;
}

/** A tab: `sessionStorage` survives reloads, each reload runs the registered scripts first. */
function fakeTab(options: { reloadPauses?: boolean; failRemove?: boolean } = {}) {
  const session = new FakeStorage();
  const scripts = new Map<string, string>();
  const calls: string[] = [];
  let next = 0;
  let win = newWindow();
  const run = (expression: string): unknown =>
    runInNewContext(expression, {
      window: win,
      sessionStorage: session,
      location: { origin: ORIGIN },
      document: { readyState: "complete" },
      DOMException: Error,
    });
  const client = {
    send: async (method: string, params: Record<string, unknown> = {}) => {
      calls.push(method);
      if (method === "Runtime.evaluate")
        return { result: { value: run(String(params.expression)) } };
      if (method === "Page.addScriptToEvaluateOnNewDocument") {
        const identifier = String(++next);
        scripts.set(identifier, String(params.source));
        return { identifier };
      }
      if (method === "Page.removeScriptToEvaluateOnNewDocument") {
        if (options.failRemove) throw new Error("gone");
        scripts.delete(String(params.identifier));
        return {};
      }
      if (method === "Page.reload") {
        win = newWindow();
        if (options.reloadPauses !== false) for (const source of scripts.values()) run(source);
        return {};
      }
      throw new Error(`unexpected ${method}`);
    },
  } as unknown as CDPClient;
  return { client, calls, session, page: () => win };
}

describe("AppPause", () => {
  test("work runs on a paused page that loads no app code and starts no worker", async () => {
    const tab = fakeTab();
    const outcome = await new AppPause(tab.client).run(async (origin) => {
      const page = tab.page();
      expect(page.stopped).toBe(true);
      expect(() => (page.Worker as () => void)()).toThrow("paused");
      return origin;
    });
    expect(outcome).toEqual({ value: ORIGIN, restarted: true });
    expect(tab.page().stopped).toBe(false);
    expect(tab.page().__capubridgePaused).toBeUndefined();
    expect(tab.calls.filter((call) => call === "Page.reload")).toHaveLength(2);
    expect(tab.calls).toContain("Page.removeScriptToEvaluateOnNewDocument");
  });

  test("a failed work still starts the app again, and its error comes back", async () => {
    const tab = fakeTab();
    await expect(
      new AppPause(tab.client).run(async () => {
        throw new Error("write failed");
      }),
    ).rejects.toThrow("write failed");
    expect(tab.page().stopped).toBe(false);
  });

  test("the pause is one-shot: the app starts even when the script cannot be removed", async () => {
    const tab = fakeTab({ failRemove: true });
    const outcome = await new AppPause(tab.client).run(async () => "done");
    expect(outcome.restarted).toBe(true);
    expect(tab.page().stopped).toBe(false);
  });

  test("a page that never comes back paused is refused and the app started again", async () => {
    const tab = fakeTab({ reloadPauses: false });
    let ran = false;
    await expect(
      new AppPause(tab.client, 300).run(async () => {
        ran = true;
      }),
    ).rejects.toBeInstanceOf(AppPauseError);
    expect(ran).toBe(false);
    expect(tab.session.getItem("__capubridgePause")).toBeNull();
  });
});
