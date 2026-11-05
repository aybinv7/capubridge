<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { StatusDot } from "@capubridge/cladd";
import { formatBytes, formatPercent, formatRate } from "../shared/format";
import { seriesValues } from "../perf/perfSeries";
import { batteryTone, loadTone, memoryTone, phaseDot } from "../perf/perfView";
import { useDeviceVitals } from "../perf/useDeviceVitals";
import { usePerfPhase } from "../perf/usePerfPhase";
import VitalTile from "./VitalTile.vue";

const PERCENT_DOMAIN = [0, 100] as const;

const router = useRouter();
const vitals = useDeviceVitals();
const { phase, copy } = usePerfPhase(vitals);

const latest = computed(() => vitals.latest.value);
const live = computed(() => phase.value === "live");
const dot = computed(() => phaseDot(phase.value));

const cpu = computed(() => latest.value?.cpuTotal ?? null);
const memory = computed(() => latest.value?.memory ?? null);
const battery = computed(() => latest.value?.battery ?? null);
const batteryLevel = computed(() => battery.value?.level ?? null);
const batteryDetail = computed(() => {
  const charging = battery.value?.charging;
  const temperature = battery.value?.temperature;
  const state = charging === true ? "Charging" : charging === false ? "On battery" : "";
  const heat =
    temperature !== null && temperature !== undefined ? `${temperature.toFixed(0)} °C` : "";
  return [state, heat].filter(Boolean).join(" · ") || undefined;
});
const network = computed(() => latest.value?.network ?? null);
const networkDetail = computed(() =>
  network.value ? `↑ ${formatRate(network.value.txBps)}` : undefined,
);

const cpuValues = computed(() => seriesValues(vitals.cpuSeries.value, "cpu"));
const memoryValues = computed(() => seriesValues(vitals.memSeries.value, "mem"));
const batteryValues = computed(() => seriesValues(vitals.batterySeries.value, "battery"));
const downloadValues = computed(() => seriesValues(vitals.rxSeries.value, "rx"));

function openPerformance() {
  void router.push({ name: "devices-performance" });
}
</script>

<template>
  <section class="flex flex-col gap-2" aria-labelledby="overview-vitals-title">
    <header class="flex items-center gap-2">
      <h2 id="overview-vitals-title" class="text-sm font-medium text-foreground">Right now</h2>
      <StatusDot :color="dot.color" :variant="dot.variant" />
      <span class="text-xs text-muted-foreground">{{ copy.label }}</span>
      <button
        v-if="vitals.paused.value || phase === 'error'"
        type="button"
        class="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        :title="phase === 'error' ? (vitals.error.value ?? undefined) : undefined"
        @click="vitals.paused.value ? vitals.resume() : vitals.retry()"
      >
        {{ vitals.paused.value ? "Resume" : "Try again" }}
      </button>
    </header>
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <VitalTile
        label="Processor"
        :value="formatPercent(cpu)"
        :value-class="loadTone(cpu)"
        :detail="vitals.coreCount.value ? `${vitals.coreCount.value} cores` : undefined"
        :values="cpuValues"
        :domain="PERCENT_DOMAIN"
        :live="live"
        @open="openPerformance"
      />
      <VitalTile
        label="Memory"
        :value="formatPercent(memory?.usedPct)"
        :value-class="memoryTone(memory?.usedPct ?? null)"
        :detail="
          memory
            ? `${formatBytes(memory.usedKb * 1024)} of ${formatBytes(memory.totalKb * 1024)}`
            : undefined
        "
        :values="memoryValues"
        :domain="PERCENT_DOMAIN"
        :live="live"
        @open="openPerformance"
      />
      <VitalTile
        label="Battery"
        :value="batteryLevel === null ? '—' : `${batteryLevel}%`"
        :value-class="batteryTone(batteryLevel)"
        :detail="batteryDetail"
        :values="batteryValues"
        :domain="PERCENT_DOMAIN"
        :live="live"
        @open="openPerformance"
      />
      <VitalTile
        label="Download"
        :value="formatRate(network?.rxBps)"
        :detail="networkDetail"
        :values="downloadValues"
        :live="live"
        tone="network"
        @open="openPerformance"
      />
    </div>
  </section>
</template>
