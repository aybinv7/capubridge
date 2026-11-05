<script setup lang="ts">
import { ArrowDown, ArrowUp, Wifi } from "lucide-vue-next";
import type { PerfMetrics } from "@/types/perf.types";
import { formatKilobyteRate, formatRate } from "../shared/format";
import PerfCard from "./PerfCard.vue";
import PerfChart from "./PerfChart.vue";
import type { PerfChartLine } from "./perfChart.types";
import type { SeriesPoint } from "./perfSeries";

const DOWNLOAD_LINES: PerfChartLine[] = [
  { key: "rx", label: "Download, KB/s", color: "var(--cat-network)" },
];
const UPLOAD_LINES: PerfChartLine[] = [
  { key: "tx", label: "Upload, KB/s", color: "var(--cat-network)" },
];

const props = defineProps<{
  metrics: PerfMetrics | null;
  download: () => readonly SeriesPoint[];
  upload: () => readonly SeriesPoint[];
}>();
</script>

<template>
  <PerfCard title="Network">
    <template #icon><Wifi :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
    <div class="flex flex-col gap-1">
      <span class="flex items-center gap-1.5 text-2xs text-muted-foreground">
        <ArrowDown :size="12" aria-hidden="true" />
        Download
        <span class="ml-auto font-mono text-xs text-foreground tabular-nums">
          {{ formatRate(props.metrics?.network.rxBps) }}
        </span>
      </span>
      <div class="h-24">
        <PerfChart
          :source="props.download"
          :lines="DOWNLOAD_LINES"
          :y-format="formatKilobyteRate"
        />
      </div>
    </div>
    <div class="flex flex-col gap-1">
      <span class="flex items-center gap-1.5 text-2xs text-muted-foreground">
        <ArrowUp :size="12" aria-hidden="true" />
        Upload
        <span class="ml-auto font-mono text-xs text-foreground tabular-nums">
          {{ formatRate(props.metrics?.network.txBps) }}
        </span>
      </span>
      <div class="h-20">
        <PerfChart
          :source="props.upload"
          :lines="UPLOAD_LINES"
          :y-format="formatKilobyteRate"
          :y-ticks="2"
        />
      </div>
    </div>
  </PerfCard>
</template>
