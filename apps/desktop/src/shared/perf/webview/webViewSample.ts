import type { CDPClient } from "@capubridge/cdp-protocol";
import { PERFORMANCE_CALL_TIMEOUT_MS } from "./performanceDomain";

export type WebViewSource = "none" | "performance" | "runtime-fallback";

export interface WebViewSample {
  heapUsedMb: number | null;
  heapTotalMb: number | null;
  nodes: number | null;
  source: WebViewSource;
}

/**
 * Which ways of reading the page work. A fallback that failed once is not asked again for this
 * page, so a WebView without it costs nothing on later readings.
 */
export interface WebViewReadPlan {
  performance: boolean;
  heapFallback: boolean;
  domFallback: boolean;
}

export function initialReadPlan(performance: boolean): WebViewReadPlan {
  return { performance, heapFallback: true, domFallback: true };
}

const MB = 1024 * 1024;

function finite(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function call<T>(client: CDPClient, method: string): Promise<T | null> {
  try {
    return await client.send<T>(method, {}, undefined, { timeoutMs: PERFORMANCE_CALL_TIMEOUT_MS });
  } catch {
    return null;
  }
}

/**
 * Reads the page's JavaScript heap and DOM node count once. The Performance domain answers both;
 * when it is missing or silent, `Runtime.getHeapUsage` and `Memory.getDOMCounters` fill the gaps.
 * Every call carries its own time limit, so a frozen page leaves nothing waiting behind it.
 */
export async function readWebViewSample(
  client: CDPClient,
  plan: WebViewReadPlan,
): Promise<WebViewSample> {
  let heapUsedMb: number | null = null;
  let heapTotalMb: number | null = null;
  let nodes: number | null = null;
  let fallback = !plan.performance;

  if (plan.performance) {
    const result = await call<{ metrics: Array<{ name: string; value: number }> }>(
      client,
      "Performance.getMetrics",
    );
    const metrics = new Map(result?.metrics.map((metric) => [metric.name, metric.value]) ?? []);
    const used = finite(metrics.get("JSHeapUsedSize"));
    const total = finite(metrics.get("JSHeapTotalSize"));
    heapUsedMb = used === null ? null : used / MB;
    heapTotalMb = total === null ? null : total / MB;
    nodes = finite(metrics.get("Nodes"));
  }

  if ((heapUsedMb === null || heapTotalMb === null) && plan.heapFallback) {
    const heap = await call<{ usedSize: number; totalSize: number }>(
      client,
      "Runtime.getHeapUsage",
    );
    const used = finite(heap?.usedSize);
    const total = finite(heap?.totalSize);
    if (used === null && total === null) plan.heapFallback = false;
    else fallback = true;
    heapUsedMb ??= used === null ? null : used / MB;
    heapTotalMb ??= total === null ? null : total / MB;
  }

  if (nodes === null && plan.domFallback) {
    const counters = await call<{ nodes: number }>(client, "Memory.getDOMCounters");
    nodes = finite(counters?.nodes);
    if (nodes === null) plan.domFallback = false;
    else fallback = true;
  }

  const any = heapUsedMb !== null || heapTotalMb !== null || nodes !== null;
  const source: WebViewSource = !any ? "none" : fallback ? "runtime-fallback" : "performance";
  return { heapUsedMb, heapTotalMb, nodes, source };
}
