import { describe, expect, test, vi } from "vite-plus/test";
import type { CDPClient } from "@capubridge/cdp-protocol";
import {
  holdPerformance,
  performanceHolders,
  releasePerformance,
} from "../webview/performanceDomain";
import { integerTicks } from "../perfSeries";
import { webViewStatusCopy } from "../webview/webViewCopy";

function fakeClient(enableWorks = true) {
  const send = vi.fn(
    async (
      method: string,
      _params?: unknown,
      _session?: unknown,
      options?: { timeoutMs?: number },
    ) => {
      if (!options?.timeoutMs) throw new Error(`${method} sent without a time limit`);
      if (method === "Performance.enable" && !enableWorks) throw new Error("not supported");
      return {};
    },
  );
  return { client: { send } as unknown as CDPClient, send };
}

describe("shared Performance domain", () => {
  test("enabled once for every holder and turned off only by the last one", async () => {
    const { client, send } = fakeClient();
    await expect(holdPerformance(client)).resolves.toBe(true);
    await expect(holdPerformance(client)).resolves.toBe(true);
    expect(send.mock.calls.filter(([method]) => method === "Performance.enable")).toHaveLength(1);
    expect(performanceHolders(client)).toBe(2);

    await releasePerformance(client);
    expect(send.mock.calls.some(([method]) => method === "Performance.disable")).toBe(false);
    await releasePerformance(client);
    expect(send.mock.calls.filter(([method]) => method === "Performance.disable")).toHaveLength(1);
    expect(performanceHolders(client)).toBe(0);
  });

  test("a page without the domain is never sent a disable", async () => {
    const { client, send } = fakeClient(false);
    await expect(holdPerformance(client)).resolves.toBe(false);
    await releasePerformance(client);
    expect(send.mock.calls.some(([method]) => method === "Performance.disable")).toBe(false);
  });

  test("letting go without holding changes nothing", async () => {
    const { client, send } = fakeClient();
    await releasePerformance(client);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("chart helpers", () => {
  test("integer ticks never repeat a label", () => {
    expect(integerTicks([0, 1], 3)).toEqual([0, 1]);
    expect(integerTicks([0, 200], 3)).toEqual([0, 100, 200]);
    expect(integerTicks([0, 0.4], 3)).toEqual([0, 1]);
  });

  test("an app in the background says the WebView readings pause, whatever their state", () => {
    expect(webViewStatusCopy("idle", "none", "background").label).toBe("In the background");
    expect(webViewStatusCopy("active", "performance", "background").detail).toBe(
      "Paused until the app is back on screen.",
    );
    expect(webViewStatusCopy("active", "performance", "foreground").label).toBe("Live");
  });
});
