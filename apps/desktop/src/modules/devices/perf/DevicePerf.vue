<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown, ArrowUp, Cpu, MemoryStick, Pause, Play, Wifi } from "lucide-vue-next";
import { Button, Spinner } from "@capubridge/cladd";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { formatBytes, formatPercent, formatRate } from "../shared/format";
import PerfCard from "./PerfCard.vue";
import PerfChart from "./PerfChart.vue";
import PerfCores from "./PerfCores.vue";
import PerfPower from "./PerfPower.vue";
import PerfStatusBar from "./PerfStatusBar.vue";
import PerfWebView from "./PerfWebView.vue";
import type { PerfChartLine } from "./perfChart.types";
import { mergeSeries } from "./perfSeries";
import { loadTone, memoryTone } from "./perfView";
import { useDeviceVitals } from "./useDeviceVitals";
import { usePerfPhase } from "./usePerfPhase";

const PERCENT_DOMAIN: [number, number] = [0, 100];
const CPU_LINES: PerfChartLine[] = [{ key: "cpu", label: "CPU", color: "var(--cat-device)" }];
const MEMORY_LINES: PerfChartLine[] = [{ key: "mem", label: "Memory", color: "var(--cat-device)" }];
const NETWORK_LINES: PerfChartLine[] = [
  { key: "rx", label: "Download KB/s", color: "var(--cat-network)" },
  { key: "tx", label: "Upload KB/s", color: "var(--cat-network)", dashed: true },
];

const vitals = useDeviceVitals();
const { phase, copy, lastSampleAt, hasReadings } = usePerfPhase(vitals);

const metrics = computed(() => vitals.latest.value);
const cpu = computed(() => (metrics.value ? metrics.value.cpuTotal : null));
const memory = computed(() => metrics.value?.memory ?? null);
const networkSeries = computed(() => mergeSeries(vitals.rxSeries.value, vitals.txSeries.value));
const live = computed(() => phase.value === "live");
const waiting = computed(() => phase.value === "waiting" || phase.value === "starting");
const coreLine = computed(() => {
  const count = vitals.coreCount.value;
  return count > 0 ? `${count} cores, averaged` : undefined;
});

function percentAxis(value: number): string {
  return `${Math.round(value)}%`;
}

useCommandProvider("screen.device-performance", () => [
  {
    id: "device.perf.toggle",
    title: vitals.paused.value ? "Resume performance monitoring" : "Pause performance monitoring",
    group: "Devices",
    icon: vitals.paused.value ? Play : Pause,
    screen: true,
    keywords: ["perf", "cpu", "memory", "monitor", "stop", "start"],
    run: () => (vitals.paused.value ? vitals.resume() : vitals.pause()),
  },
]);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PerfStatusBar
      :phase="phase"
      :copy="copy"
      :last-sample-at="lastSampleAt"
      :paused="vitals.paused.value"
      :show-detail="hasReadings"
      @pause="vitals.pause()"
      @resume="vitals.resume()"
    />

    <div
      v-if="phase === 'error'"
      class="flex items-start gap-3 rounded-control bg-surface-cut px-3 py-2 shadow-cut"
      :class="hasReadings ? 'mx-4 mt-3' : 'mx-auto my-auto w-full max-w-md'"
      role="alert"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <p class="text-xs text-foreground">{{ copy.detail }}</p>
        <p class="font-mono text-2xs break-all text-error">{{ vitals.error.value }}</p>
      </div>
      <Button size="sm" variant="transparent" @click="vitals.retry()">Try again</Button>
    </div>

    <div
      v-if="!hasReadings && phase !== 'error'"
      class="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <Spinner v-if="waiting" size="sm" />
      <p class="max-w-sm text-sm text-muted-foreground">{{ copy.detail }}</p>
    </div>

    <div v-else-if="hasReadings" class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
      <section class="flex flex-col gap-3" aria-labelledby="perf-phone-title">
        <h2 id="perf-phone-title" class="text-sm font-medium text-foreground">Phone</h2>

        <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <PerfCard
            title="Processor"
            :value="formatPercent(cpu)"
            :value-class="loadTone(cpu)"
            :detail="coreLine"
          >
            <template #icon><Cpu :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
            <div class="h-36">
              <PerfChart
                :series="vitals.cpuSeries.value"
                :lines="CPU_LINES"
                :latest-timestamp="lastSampleAt"
                :y-domain="PERCENT_DOMAIN"
                :y-format="percentAxis"
              />
            </div>
          </PerfCard>
          <PerfCard
            title="Memory"
            :value="formatPercent(memory?.usedPct)"
            :value-class="memoryTone(memory?.usedPct ?? null)"
            :detail="
              memory
                ? `${formatBytes(memory.usedKb * 1024)} of ${formatBytes(memory.totalKb * 1024)}`
                : undefined
            "
          >
            <template #icon>
              <MemoryStick :size="13" :stroke-width="1.8" aria-hidden="true" />
            </template>
            <div class="h-36">
              <PerfChart
                :series="vitals.memSeries.value"
                :lines="MEMORY_LINES"
                :latest-timestamp="lastSampleAt"
                :y-domain="PERCENT_DOMAIN"
                :y-format="percentAxis"
              />
            </div>
          </PerfCard>
        </div>

        <PerfCard title="Load per core">
          <PerfCores
            :cores="vitals.perCoreLatest.value"
            :series="vitals.perCoreSeries.value"
            :live="live"
          />
        </PerfCard>

        <div class="grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr]">
          <PerfCard title="Network">
            <template #icon><Wifi :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
            <template #aside>
              <span class="flex items-center gap-3 font-mono text-xs tabular-nums">
                <span class="flex items-center gap-1 text-foreground" title="Download">
                  <ArrowDown :size="12" aria-label="Download" />
                  {{ formatRate(metrics?.network.rxBps) }}
                </span>
                <span class="flex items-center gap-1 text-muted-foreground" title="Upload">
                  <ArrowUp :size="12" aria-label="Upload" />
                  {{ formatRate(metrics?.network.txBps) }}
                </span>
              </span>
            </template>
            <div class="h-36">
              <PerfChart
                :series="networkSeries"
                :lines="NETWORK_LINES"
                :latest-timestamp="lastSampleAt"
              />
            </div>
          </PerfCard>
          <PerfPower :metrics="metrics" />
        </div>
      </section>

      <PerfWebView
        :status="vitals.cdpMetricsStatus.value"
        :message="vitals.cdpMetricsMessage.value"
        :source="vitals.cdpMetricsSource.value"
        :updated-at="vitals.cdpLastUpdatedAt.value"
        :heap-used="vitals.heapUsedSeries.value"
        :heap-total="vitals.heapTotalSeries.value"
        :dom-nodes="vitals.domNodesSeries.value"
      />
    </div>
  </div>
</template>
