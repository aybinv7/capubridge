import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import type { CDPClient } from "@capubridge/cdp-protocol";
import { useConnectionStore } from "@/stores/connection.store";
import type { SeriesPoint } from "../perfSeries";
import { SampleRing } from "../sampleRing";
import {
  readWebViewSample,
  WEBVIEW_CALL_TIMEOUT_MS,
  withTimeout,
  type WebViewSource,
} from "./webViewSample";

export type WebViewMetricsStatus = "idle" | "waiting" | "active" | "degraded" | "error";

const PERIOD_MS = 1000;
const HISTORY_SAMPLES = 60;

async function enable(client: CDPClient, method: string): Promise<boolean> {
  try {
    await withTimeout(client.send(method, {}), WEBVIEW_CALL_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

/**
 * JavaScript heap and DOM nodes of the connected WebView, read once a second while `active`.
 * Each read waits for the previous one, so a slow page never piles calls up; leaving turns the
 * Performance domain off again.
 */
export function useWebViewMetrics(active: Readonly<Ref<boolean>>) {
  const connections = useConnectionStore();
  const history = new SampleRing(HISTORY_SAMPLES, PERIOD_MS);
  const version = shallowRef(0);

  const status = ref<WebViewMetricsStatus>("idle");
  const source = ref<WebViewSource>("none");
  const updatedAt = ref<number | null>(null);
  const failure = ref<string | null>(null);

  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let enabledClient: CDPClient | null = null;

  const targetId = computed(() => {
    const connection = connections.activeConnection;
    return connection?.status === "connected" ? connection.targetId : null;
  });

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  async function disablePerformance() {
    const client = enabledClient;
    enabledClient = null;
    if (!client) return;
    try {
      await withTimeout(client.send("Performance.disable", {}), WEBVIEW_CALL_TIMEOUT_MS);
    } catch {
      return;
    }
  }

  async function tick(ticket: number, client: CDPClient, performanceEnabled: boolean) {
    const sample = await readWebViewSample(client, performanceEnabled);
    if (ticket !== generation) return;
    const now = Date.now();
    history.push(now, {
      heapUsed: sample.heapUsedMb,
      heapTotal: sample.heapTotalMb,
      domNodes: sample.nodes,
    });
    version.value += 1;
    updatedAt.value = now;
    source.value = sample.source;
    status.value = sample.source === "performance" ? "active" : "degraded";
    timer = setTimeout(() => void tick(ticket, client, performanceEnabled), PERIOD_MS);
  }

  async function begin(id: string) {
    const ticket = ++generation;
    const client = connections.getClient(id);
    if (!client) {
      status.value = "waiting";
      return;
    }
    status.value = "waiting";
    failure.value = null;
    const performanceEnabled = await enable(client, "Performance.enable");
    if (ticket !== generation) return;
    if (performanceEnabled) enabledClient = client;
    await enable(client, "Runtime.enable");
    if (ticket !== generation) return;
    try {
      await tick(ticket, client, performanceEnabled);
    } catch (err) {
      if (ticket !== generation) return;
      status.value = "error";
      failure.value = String(err);
    }
  }

  function end() {
    generation += 1;
    clearTimer();
    void disablePerformance();
    status.value = "idle";
    source.value = "none";
  }

  watch(
    [active, targetId],
    ([run, id], previous) => {
      const previousId = previous?.[1];
      end();
      if (id !== previousId) {
        history.clear();
        updatedAt.value = null;
        version.value += 1;
      }
      if (run && id) void begin(id);
      else if (run) status.value = "waiting";
    },
    { immediate: true },
  );

  onScopeDispose(end);

  /** Chart points of `heapUsed`, `heapTotal` or `domNodes`. */
  function series(channel: string): SeriesPoint[] {
    void version.value;
    return history.series(channel);
  }

  return { status, source, updatedAt, failure, targetId, series };
}
