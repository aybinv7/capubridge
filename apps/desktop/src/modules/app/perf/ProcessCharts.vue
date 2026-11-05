<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementVisibility } from "@vueuse/core";
import { Cpu, ListTree, MemoryStick } from "lucide-vue-next";
import { formatBytes } from "@/shared/format/numbers";
import PerfCard from "@/shared/perf/PerfCard.vue";
import PerfChart from "@/shared/perf/PerfChart.vue";
import type { PerfChartLine } from "@/shared/perf/perfChart.types";
import { seriesStats, type SeriesStats } from "@/shared/perf/perfSeries";
import { coresWords, cpuDomain, formatCpu } from "../process/cpuFormat";
import type { AppProcess } from "../process/useAppProcess";
import MemoryComposition from "./MemoryComposition.vue";

const MEMORY_LINES: PerfChartLine[] = [{ key: "pss", label: "Memory", color: "var(--foreground)" }];
const CPU_LINES: PerfChartLine[] = [{ key: "cpu", label: "Processor", color: "var(--foreground)" }];
const THREAD_LINES: PerfChartLine[] = [
  { key: "threads", label: "Threads", color: "var(--foreground)" },
];

const props = defineProps<{
  process: AppProcess;
  /** The time window every chart on the page shares. */
  window: [number, number];
}>();

const root = ref<HTMLElement | null>(null);
const onScreen = useElementVisibility(root);

const sample = computed(() => props.process.latest.value);
const running = computed(() => sample.value?.running === true);
const memory = computed(() => (running.value ? (sample.value?.memory ?? null) : null));
const cpu = computed(() => (running.value ? (sample.value?.cpu ?? null) : null));
const threads = computed(() => (running.value ? (sample.value?.threads ?? null) : null));
const cpuScale = computed(() => cpuDomain(props.process.values("cpu")));
const hasThreads = computed(() => props.process.values("threads").some((value) => value !== null));

const memorySource = () => props.process.memorySeries();
const cpuSource = () => props.process.series("cpu");
const threadSource = () => props.process.series("threads");

function statsWhileShown(build: () => SeriesStats | null) {
  return computed(() => (onScreen.value ? build() : null));
}

const memoryStats = statsWhileShown(() => seriesStats(props.process.memorySeries(), "pss"));
const cpuStats = statsWhileShown(() => seriesStats(props.process.series("cpu"), "cpu"));
const threadStats = statsWhileShown(() => seriesStats(props.process.series("threads"), "threads"));

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

function summary(stats: SeriesStats | null, format: (v: number) => string) {
  return stats ? `Average ${format(stats.avg)} · peak ${format(stats.max)}` : undefined;
}
</script>

<template>
  <div ref="root" class="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
    <PerfCard
      title="Memory"
      :value="memory ? formatBytes(memory.totalPssKb * 1024) : '—'"
      :detail="summary(memoryStats, megabytes)"
      class="@3xl:col-span-2"
    >
      <template #icon><MemoryStick :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
      <div class="h-36">
        <PerfChart
          :source="memorySource"
          :lines="MEMORY_LINES"
          :y-format="megabyteAxis"
          :x-domain="props.window"
        />
      </div>
      <MemoryComposition :memory="memory" />
    </PerfCard>
    <PerfCard
      title="Processor"
      :value="formatCpu(cpu?.totalPct)"
      :detail="summary(cpuStats, formatCpu) ?? coresWords(props.process.cores.value)"
      :class="!hasThreads && '@3xl:col-span-2'"
    >
      <template #icon><Cpu :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
      <div class="h-32">
        <PerfChart
          :source="cpuSource"
          :lines="CPU_LINES"
          :y-domain="cpuScale"
          :y-format="percentAxis"
          :x-domain="props.window"
        />
      </div>
      <p class="text-2xs text-muted-foreground tabular-nums">
        <template v-if="cpu">
          {{ formatCpu(cpu.userPct) }} in the app's own code · {{ formatCpu(cpu.systemPct) }} in the
          system for it ·
        </template>
        100% is all {{ props.process.cores.value ?? "the" }} cores of the phone
      </p>
    </PerfCard>
    <PerfCard
      v-if="hasThreads"
      title="Threads"
      :value="threads === null ? '—' : count(threads)"
      :detail="summary(threadStats, count)"
    >
      <template #icon><ListTree :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
      <div class="h-32">
        <PerfChart
          :source="threadSource"
          :lines="THREAD_LINES"
          :y-format="count"
          :x-domain="props.window"
          integer
        />
      </div>
    </PerfCard>
  </div>
</template>
