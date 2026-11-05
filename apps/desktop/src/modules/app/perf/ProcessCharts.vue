<script setup lang="ts">
import { computed } from "vue";
import { Cpu, ListTree, MemoryStick } from "lucide-vue-next";
import { formatBytes, formatPercent } from "@/shared/format/numbers";
import PerfCard from "@/shared/perf/PerfCard.vue";
import PerfChart from "@/shared/perf/PerfChart.vue";
import type { PerfChartLine } from "@/shared/perf/perfChart.types";
import { seriesStats } from "@/shared/perf/perfSeries";
import { loadTone } from "@/shared/perf/tones";
import type { AppProcess } from "../process/useAppProcess";
import MemoryComposition from "./MemoryComposition.vue";

const PERCENT_DOMAIN: [number, number] = [0, 100];
const MEMORY_LINES: PerfChartLine[] = [{ key: "pss", label: "Memory", color: "var(--foreground)" }];
const CPU_LINES: PerfChartLine[] = [{ key: "cpu", label: "Processor", color: "var(--foreground)" }];
const THREAD_LINES: PerfChartLine[] = [
  { key: "threads", label: "Threads", color: "var(--foreground)" },
];

const props = defineProps<{ process: AppProcess }>();

const sample = computed(() => props.process.latest.value);
const running = computed(() => sample.value?.running === true);
const memory = computed(() => (running.value ? (sample.value?.memory ?? null) : null));
const cpu = computed(() => (running.value ? (sample.value?.cpu ?? null) : null));
const threads = computed(() => (running.value ? (sample.value?.threads ?? null) : null));

const memorySource = () => props.process.series("pss");
const cpuSource = () => props.process.series("cpu");
const threadSource = () => props.process.series("threads");

const memoryStats = computed(() => seriesStats(props.process.series("pss"), "pss"));
const cpuStats = computed(() => seriesStats(props.process.series("cpu"), "cpu"));
const threadStats = computed(() => seriesStats(props.process.series("threads"), "threads"));

function megabytes(value: number): string {
  return formatBytes(value * 1024 * 1024);
}

function megabyteAxis(value: number): string {
  return `${Math.round(value)} MB`;
}

function percentAxis(value: number): string {
  return `${Math.round(value)}%`;
}

function count(value: number): string {
  return Math.round(value).toLocaleString();
}

function summary(stats: { avg: number; max: number } | null, format: (v: number) => string) {
  return stats ? `Average ${format(stats.avg)} · peak ${format(stats.max)}` : undefined;
}
</script>

<template>
  <div class="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
    <PerfCard
      title="Memory"
      :value="memory ? formatBytes(memory.totalPssKb * 1024) : '—'"
      :detail="summary(memoryStats, megabytes)"
      class="@3xl:col-span-2"
    >
      <template #icon><MemoryStick :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
      <div class="h-36">
        <PerfChart :source="memorySource" :lines="MEMORY_LINES" :y-format="megabyteAxis" />
      </div>
      <MemoryComposition :memory="memory" />
    </PerfCard>
    <PerfCard
      title="Processor"
      :value="formatPercent(cpu?.totalPct)"
      :value-class="loadTone(cpu?.totalPct ?? null)"
      :detail="summary(cpuStats, percentAxis)"
    >
      <template #icon><Cpu :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
      <div class="h-32">
        <PerfChart
          :source="cpuSource"
          :lines="CPU_LINES"
          :y-domain="PERCENT_DOMAIN"
          :y-format="percentAxis"
        />
      </div>
      <p v-if="cpu" class="text-2xs text-muted-foreground tabular-nums">
        {{ formatPercent(cpu.userPct) }} in the app's own code ·
        {{ formatPercent(cpu.kernelPct) }} in the system for it
      </p>
    </PerfCard>
    <PerfCard
      title="Threads"
      :value="threads === null ? '—' : count(threads)"
      :detail="summary(threadStats, count)"
    >
      <template #icon><ListTree :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
      <div class="h-32">
        <PerfChart :source="threadSource" :lines="THREAD_LINES" :y-format="count" />
      </div>
    </PerfCard>
  </div>
</template>
