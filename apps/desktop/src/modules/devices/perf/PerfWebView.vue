<script setup lang="ts">
import { computed } from "vue";
import { Layers } from "lucide-vue-next";
import { StatusDot, type Color } from "@capubridge/cladd";
import type { CdpMetricsStatus } from "./usePerfMetrics";
import { formatClock } from "../shared/format";
import PerfCard from "./PerfCard.vue";
import PerfChart from "./PerfChart.vue";
import type { PerfChartLine } from "./perfChart.types";
import { mergeSeries, seriesStats, type SeriesPoint, type SeriesStats } from "./perfSeries";

const props = defineProps<{
  status: CdpMetricsStatus;
  message: string;
  source: "none" | "performance" | "runtime-fallback";
  updatedAt: number | null;
  heapUsed: readonly SeriesPoint[];
  heapTotal: readonly SeriesPoint[];
  domNodes: readonly SeriesPoint[];
}>();

const HEAP_LINES: PerfChartLine[] = [
  { key: "heapUsed", label: "Used", color: "var(--foreground)" },
  { key: "heapTotal", label: "Allocated", color: "var(--muted-foreground)", dashed: true },
];
const NODE_LINES: PerfChartLine[] = [
  { key: "domNodes", label: "DOM nodes", color: "var(--foreground)" },
];

const STATUS_WORDS: Record<CdpMetricsStatus, { label: string; color: Color | undefined }> = {
  idle: { label: "Idle", color: undefined },
  waiting: { label: "Waiting", color: undefined },
  active: { label: "Live", color: "lime" },
  degraded: { label: "Partial", color: "yellow" },
  error: { label: "Stopped", color: "red" },
};

const statusWord = computed(() => STATUS_WORDS[props.status]);
const sourceWord = computed(() => {
  if (props.source === "performance") return "Performance domain";
  if (props.source === "runtime-fallback") return "Runtime and memory fallback";
  return null;
});
const heapSeries = computed(() => mergeSeries(props.heapUsed, props.heapTotal));
const heapStats = computed(() => seriesStats(props.heapUsed, "heapUsed"));
const heapTotalStats = computed(() => seriesStats(props.heapTotal, "heapTotal"));
const nodeStats = computed(() => seriesStats(props.domNodes, "domNodes"));
const heapDetail = computed(() => {
  const used = summary(heapStats.value, megabytes);
  const allocated = heapTotalStats.value;
  return allocated ? `${used} · ${megabytes(allocated.now)} allocated` : used;
});

function megabytes(value: number): string {
  return `${value.toFixed(value >= 100 ? 0 : 1)} MB`;
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
  <section class="flex flex-col gap-3" aria-labelledby="perf-webview-title">
    <header class="flex items-center gap-2">
      <Layers :size="14" :stroke-width="1.8" class="text-muted-foreground" aria-hidden="true" />
      <h2 id="perf-webview-title" class="text-sm font-medium text-foreground">WebView</h2>
      <StatusDot :color="statusWord.color" :variant="statusWord.color ? 'solid' : 'hollow'" />
      <span class="text-xs text-muted-foreground">{{ statusWord.label }}</span>
      <span class="min-w-0 truncate text-xs text-[var(--fg-subtle)]">{{ props.message }}</span>
      <span class="flex-1" />
      <span
        v-if="props.updatedAt !== null"
        class="shrink-0 font-mono text-2xs text-[var(--fg-subtle)] tabular-nums"
        :title="sourceWord ? `Read through the ${sourceWord}` : undefined"
      >
        {{ formatClock(props.updatedAt) }}
      </span>
    </header>

    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <PerfCard
        title="JavaScript heap"
        :value="heapStats ? megabytes(heapStats.now) : '—'"
        :detail="heapDetail"
      >
        <div class="h-32">
          <PerfChart :series="heapSeries" :lines="HEAP_LINES" :latest-timestamp="props.updatedAt" />
        </div>
      </PerfCard>
      <PerfCard
        title="DOM nodes"
        :value="nodeStats ? count(nodeStats.now) : '—'"
        :detail="summary(nodeStats, count)"
      >
        <div class="h-32">
          <PerfChart
            :series="props.domNodes"
            :lines="NODE_LINES"
            :latest-timestamp="props.updatedAt"
          />
        </div>
      </PerfCard>
    </div>
  </section>
</template>
