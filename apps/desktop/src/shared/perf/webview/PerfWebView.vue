<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementVisibility } from "@vueuse/core";
import { Layers } from "lucide-vue-next";
import { StatusDot } from "@capubridge/cladd";
import type { AppPresence } from "@/lib/gates/presence";
import { formatClock } from "@/shared/format/numbers";
import PerfCard from "../PerfCard.vue";
import PerfChart from "../PerfChart.vue";
import PerfLegend from "../PerfLegend.vue";
import type { PerfChartLine } from "../perfChart.types";
import { mergeSeries, seriesStats, type SeriesPoint, type SeriesStats } from "../perfSeries";
import type { WebViewSource } from "./webViewSample";
import type { WebViewMetricsStatus } from "./useWebViewMetrics";
import { webViewStatusCopy } from "./webViewCopy";

const props = defineProps<{
  status: WebViewMetricsStatus;
  source: WebViewSource;
  presence: AppPresence;
  updatedAt: number | null;
  failure: string | null;
  series: (channel: string) => SeriesPoint[];
  /** A time window shared with other charts on the page. */
  xDomain?: [number, number];
}>();

const root = ref<HTMLElement | null>(null);
const onScreen = useElementVisibility(root);

const HEAP_LINES: PerfChartLine[] = [
  { key: "heapUsed", label: "Used", color: "var(--foreground)" },
  { key: "heapTotal", label: "Allocated", color: "var(--muted-foreground)", dashed: true },
];
const NODE_LINES: PerfChartLine[] = [
  { key: "domNodes", label: "DOM nodes", color: "var(--foreground)" },
];

const heapSource = () => mergeSeries(props.series("heapUsed"), props.series("heapTotal"));
const nodeSource = () => props.series("domNodes");

const statusCopy = computed(() => webViewStatusCopy(props.status, props.source, props.presence));
function statsWhileShown(channel: string) {
  return computed(() => (onScreen.value ? seriesStats(props.series(channel), channel) : null));
}

const heapStats = statsWhileShown("heapUsed");
const allocatedStats = statsWhileShown("heapTotal");
const nodeStats = statsWhileShown("domNodes");

function megabytes(value: number): string {
  return `${value.toFixed(value >= 100 ? 0 : 1)} MB`;
}

function megabyteAxis(value: number): string {
  return `${Math.round(value)} MB`;
}

function count(value: number): string {
  return Math.round(value).toLocaleString();
}

function summary(stats: SeriesStats | null, format: (value: number) => string): string {
  if (!stats) return "No reading yet";
  return `Average ${format(stats.avg)} · peak ${format(stats.max)}`;
}
</script>

<template>
  <section ref="root" class="flex flex-col gap-3" aria-labelledby="perf-webview-title">
    <header class="flex min-w-0 items-center gap-2">
      <Layers :size="14" :stroke-width="1.8" class="text-muted-foreground" aria-hidden="true" />
      <h2 id="perf-webview-title" class="text-sm font-medium text-foreground">WebView</h2>
      <StatusDot :color="statusCopy.color" :variant="statusCopy.variant" />
      <span class="shrink-0 text-xs text-muted-foreground">{{ statusCopy.label }}</span>
      <span
        class="min-w-0 truncate text-xs text-[var(--fg-subtle)]"
        :title="props.failure ?? statusCopy.sourceHint ?? undefined"
      >
        {{ statusCopy.detail }}
      </span>
      <span class="flex-1" />
      <span
        v-if="props.updatedAt !== null"
        class="shrink-0 font-mono text-2xs text-[var(--fg-subtle)] tabular-nums"
        :title="`Newest reading at ${formatClock(props.updatedAt)}`"
      >
        {{ formatClock(props.updatedAt) }}
      </span>
    </header>

    <div v-if="props.updatedAt !== null" class="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
      <PerfCard
        title="JavaScript heap"
        :value="heapStats ? megabytes(heapStats.now) : '—'"
        :detail="allocatedStats ? `${megabytes(allocatedStats.now)} allocated` : undefined"
      >
        <div class="h-32">
          <PerfChart
            :source="heapSource"
            :lines="HEAP_LINES"
            :y-format="megabyteAxis"
            :x-domain="props.xDomain"
          />
        </div>
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <PerfLegend :lines="HEAP_LINES" />
          <dl class="flex flex-col gap-0.5 text-right text-2xs text-muted-foreground tabular-nums">
            <div>
              <dt class="sr-only">Used</dt>
              <dd>Used: {{ summary(heapStats, megabytes) }}</dd>
            </div>
            <div>
              <dt class="sr-only">Allocated</dt>
              <dd>Allocated: {{ summary(allocatedStats, megabytes) }}</dd>
            </div>
          </dl>
        </div>
      </PerfCard>
      <PerfCard
        title="DOM nodes"
        :value="nodeStats ? count(nodeStats.now) : '—'"
        :detail="summary(nodeStats, count)"
      >
        <div class="h-32">
          <PerfChart
            :source="nodeSource"
            :lines="NODE_LINES"
            :y-format="count"
            :x-domain="props.xDomain"
            integer
          />
        </div>
      </PerfCard>
    </div>
  </section>
</template>
