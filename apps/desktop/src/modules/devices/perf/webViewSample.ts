import type { CDPClient } from "@capubridge/cdp-protocol";

/** A CDP call that has not answered after this long is given up for this tick. */
export const WEBVIEW_CALL_TIMEOUT_MS = 2000;

export type WebViewSource = "none" | "performance" | "runtime-fallback";

export interface WebViewSample {
  heapUsedMb: number | null;
  heapTotalMb: number | null;
  nodes: number | null;
  source: WebViewSource;
}

const MB = 1024 * 1024;

/** Resolves with the call's answer, or rejects once `timeoutMs` passes without one. */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`No answer in ${timeoutMs} ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function finite(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function call<T>(client: CDPClient, method: string): Promise<T | null> {
  try {
    return await withTimeout(client.send<T>(method, {}), WEBVIEW_CALL_TIMEOUT_MS);
  } catch {
    return null;
  }
}

/**
 * Reads the page's JavaScript heap and DOM node count once. The Performance domain answers both;
 * when it is missing or silent, `Runtime.getHeapUsage` and `Memory.getDOMCounters` fill the gaps.
 */
export async function readWebViewSample(
  client: CDPClient,
  performanceEnabled: boolean,
): Promise<WebViewSample> {
  let heapUsedMb: number | null = null;
  let heapTotalMb: number | null = null;
  let nodes: number | null = null;
  let fallback = !performanceEnabled;

  if (performanceEnabled) {
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

  if (heapUsedMb === null || heapTotalMb === null) {
    const heap = await call<{ usedSize: number; totalSize: number }>(
      client,
      "Runtime.getHeapUsage",
    );
    const used = finite(heap?.usedSize);
    const total = finite(heap?.totalSize);
    if (used !== null || total !== null) fallback = true;
    heapUsedMb ??= used === null ? null : used / MB;
    heapTotalMb ??= total === null ? null : total / MB;
  }

  if (nodes === null) {
    const counters = await call<{ nodes: number }>(client, "Memory.getDOMCounters");
    nodes = finite(counters?.nodes);
    if (nodes !== null) fallback = true;
  }

  const any = heapUsedMb !== null || heapTotalMb !== null || nodes !== null;
  const source: WebViewSource = !any ? "none" : fallback ? "runtime-fallback" : "performance";
  return { heapUsedMb, heapTotalMb, nodes, source };
}
