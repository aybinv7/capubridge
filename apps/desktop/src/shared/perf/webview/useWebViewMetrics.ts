import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import type { CDPClient } from "@capubridge/cdp-protocol";
import { useConnectionStore } from "@/stores/connection.store";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { useTargetsStore } from "@/stores/targets.store";
import type { SeriesPoint } from "../perfSeries";
import { SampleRing } from "../sampleRing";
import {
  holdPerformance,
  PERFORMANCE_CALL_TIMEOUT_MS,
  releasePerformance,
} from "./performanceDomain";
import { initialReadPlan, readWebViewSample, type WebViewSource } from "./webViewSample";

export type WebViewMetricsStatus = "idle" | "waiting" | "active" | "degraded" | "error";

const PERIOD_MS = 1000;
const DEFAULT_HISTORY_MS = 60_000;

/**
 * JavaScript heap and DOM nodes of the selected target's WebView, read once a second while
 * `active` and the app is on screen: Android may freeze an app in the background, and every
 * call to it would wait out its time limit. Each read waits for the previous one; the
 * Performance domain is shared with every other reader of the page and let go on leave.
 */
export function useWebViewMetrics(
  active: Readonly<Ref<boolean>>,
  options: { historyMs?: number } = {},
) {
  const connections = useConnectionStore();
  const targets = useTargetsStore();
  const presence = useTargetPresenceStore();
  const history = new SampleRing((options.historyMs ?? DEFAULT_HISTORY_MS) / PERIOD_MS, PERIOD_MS);
  const version = shallowRef(0);

  const status = ref<WebViewMetricsStatus>("idle");
  const source = ref<WebViewSource>("none");
  const updatedAt = ref<number | null>(null);
  const failure = ref<string | null>(null);

  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let heldClient: CDPClient | null = null;

  const targetId = computed(() => {
    const id = targets.selectedTarget?.id;
    if (!id) return null;
    return connections.connections.get(id)?.status === "connected" ? id : null;
  });
  const inBackground = computed(() => presence.presence === "background");
  const running = computed(() => active.value && !inBackground.value);

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function letGo() {
    const client = heldClient;
    heldClient = null;
    if (client) void releasePerformance(client);
  }

  async function tick(ticket: number, client: CDPClient, plan: ReturnType<typeof initialReadPlan>) {
    const sample = await readWebViewSample(client, plan);
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
    timer = setTimeout(() => void tick(ticket, client, plan), PERIOD_MS);
  }

  async function begin(id: string) {
    const ticket = ++generation;
    const client = connections.getClient(id);
    status.value = "waiting";
    if (!client) return;
    failure.value = null;
    heldClient = client;
    const performanceEnabled = await holdPerformance(client);
    if (ticket !== generation) return;
    try {
      await client.send("Runtime.enable", {}, undefined, {
        timeoutMs: PERFORMANCE_CALL_TIMEOUT_MS,
      });
    } catch (err) {
      console.warn("Runtime.enable did not answer for the WebView metrics", err);
    }
    if (ticket !== generation) return;
    try {
      await tick(ticket, client, initialReadPlan(performanceEnabled));
    } catch (err) {
      if (ticket !== generation) return;
      status.value = "error";
      failure.value = String(err);
    }
  }

  function end() {
    generation += 1;
    clearTimer();
    letGo();
    status.value = "idle";
    source.value = "none";
  }

  watch(
    [running, targetId],
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
