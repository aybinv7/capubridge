<script setup lang="ts">
import { computed } from "vue";
import { useDocumentVisibility } from "@vueuse/core";
import { Cpu, MemoryStick, Pause, Play } from "lucide-vue-next";
import { Button, Spinner } from "@capubridge/cladd";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { formatBytes, formatPercent } from "../shared/format";
import PerfCard from "./PerfCard.vue";
import PerfChart from "./PerfChart.vue";
import PerfCores from "./PerfCores.vue";
import PerfNetwork from "./PerfNetwork.vue";
import PerfPower from "./PerfPower.vue";
import PerfStatusBar from "./PerfStatusBar.vue";
import PerfWebView from "./PerfWebView.vue";
import type { PerfChartLine } from "./perfChart.types";
import { hasPerfReadings, loadTone, memoryTone } from "./perfView";
import { useDeviceVitals } from "./useDeviceVitals";
import { usePerfPhase } from "./usePerfPhase";
import { useWebViewMetrics } from "./useWebViewMetrics";

const PERCENT_DOMAIN: [number, number] = [0, 100];
const CPU_LINES: PerfChartLine[] = [{ key: "cpu", label: "CPU", color: "var(--cat-device)" }];
const MEMORY_LINES: PerfChartLine[] = [{ key: "mem", label: "Memory", color: "var(--cat-device)" }];

const vitals = useDeviceVitals();
const { phase, copy, lastSampleAt } = usePerfPhase(vitals);
const visibility = useDocumentVisibility();
const presence = useTargetPresenceStore();
const webView = useWebViewMetrics(
  computed(() => visibility.value === "visible" && !vitals.paused.value),
);

const metrics = computed(() => vitals.latest.value);
const cpu = computed(() => (metrics.value ? metrics.value.cpuTotal : null));
const memory = computed(() => metrics.value?.memory ?? null);
const live = computed(() => phase.value === "live");
const waiting = computed(() => phase.value === "waiting" || phase.value === "starting");
const hasReadings = computed(() =>
  hasPerfReadings(vitals.tickCount.value, webView.updatedAt.value),
);
const coreLine = computed(() => {
  const count = vitals.coreCount.value;
  return count > 0 ? `${count} cores, averaged` : undefined;
});

const cpuSource = () => vitals.series("cpu");
const memorySource = () => vitals.series("mem");
const downloadSource = () => vitals.series("rx");
const uploadSource = () => vitals.series("tx");
const coreValues = (core: number) => vitals.values(`core${core}`);

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

    <div v-else-if="hasReadings" class="@container min-h-0 flex-1 overflow-y-auto">
      <div class="flex flex-col gap-6 p-4">
        <section class="flex flex-col gap-3" aria-labelledby="perf-phone-title">
          <h2 id="perf-phone-title" class="text-sm font-medium text-foreground">Phone</h2>

          <div class="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
            <PerfCard
              title="Processor"
              :value="formatPercent(cpu)"
              :value-class="loadTone(cpu)"
              :detail="coreLine"
            >
              <template #icon><Cpu :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
              <div class="h-36">
                <PerfChart
                  :source="cpuSource"
                  :lines="CPU_LINES"
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
                  :source="memorySource"
                  :lines="MEMORY_LINES"
                  :y-domain="PERCENT_DOMAIN"
                  :y-format="percentAxis"
                />
              </div>
            </PerfCard>
          </div>

          <PerfCard title="Load per core">
            <PerfCores :cores="vitals.perCoreLatest.value" :values="coreValues" :live="live" />
          </PerfCard>

          <div class="grid grid-cols-1 gap-3 @3xl:grid-cols-[2fr_1fr]">
            <PerfNetwork :metrics="metrics" :download="downloadSource" :upload="uploadSource" />
            <PerfPower :metrics="metrics" :charge="vitals.chargeSeries()" />
          </div>
        </section>

        <PerfWebView
          :status="webView.status.value"
          :source="webView.source.value"
          :presence="presence.presence"
          :updated-at="webView.updatedAt.value"
          :failure="webView.failure.value"
          :series="webView.series"
        />
      </div>
    </div>
  </div>
</template>
