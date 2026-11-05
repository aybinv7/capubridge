<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { StatusDot } from "@capubridge/cladd";
import { formatBytes, formatPercent } from "@/shared/format/numbers";
import VitalTile from "@/shared/perf/VitalTile.vue";
import { useAppSession } from "../appSession";

const PERCENT_DOMAIN = [0, 100] as const;

const router = useRouter();
const { process, phase: processState } = useAppSession();
const { phase, copy, mark } = processState;
const { paused, error } = process;

const sample = computed(() => process.latest.value);
const running = computed(() => sample.value?.running === true);
const live = computed(() => phase.value === "live");

const memory = computed(() =>
  running.value && sample.value ? formatBytes(sample.value.memory.totalPssKb * 1024) : "—",
);
const memoryDetail = computed(() =>
  running.value && sample.value?.pid !== null && sample.value?.pid !== undefined
    ? `PID ${sample.value.pid}`
    : undefined,
);
const cpu = computed(() => (running.value ? (sample.value?.cpu?.totalPct ?? null) : null));
const cpuDetail = computed(() => {
  const reading = running.value ? sample.value?.cpu : null;
  return reading
    ? `${formatPercent(reading.userPct)} app · ${formatPercent(reading.kernelPct)} system`
    : undefined;
});
const threads = computed(() => (running.value ? (sample.value?.threads ?? null) : null));

const memoryValues = computed(() => process.values("pss"));
const cpuValues = computed(() => process.values("cpu"));
const threadValues = computed(() => process.values("threads"));

function openPerformance() {
  void router.push({ name: "app-performance" });
}
</script>

<template>
  <section class="@container flex flex-col gap-2" aria-labelledby="app-vitals-title">
    <header class="flex items-center gap-2">
      <h2 id="app-vitals-title" class="text-sm font-medium text-foreground">Right now</h2>
      <StatusDot :color="mark.color" :variant="mark.variant" />
      <span class="text-xs text-muted-foreground">{{ copy.label }}</span>
      <button
        v-if="paused || phase === 'error'"
        type="button"
        class="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        :title="phase === 'error' ? (error ?? undefined) : undefined"
        @click="paused ? process.resume() : process.retry()"
      >
        {{ paused ? "Resume" : "Try again" }}
      </button>
    </header>
    <div class="grid grid-cols-1 gap-3 @lg:grid-cols-3">
      <VitalTile
        label="Memory"
        :value="memory"
        :detail="memoryDetail"
        :values="memoryValues"
        :live="live"
        @open="openPerformance"
      />
      <VitalTile
        label="Processor"
        :value="formatPercent(cpu)"
        :detail="cpuDetail"
        :values="cpuValues"
        :domain="PERCENT_DOMAIN"
        :live="live"
        @open="openPerformance"
      />
      <VitalTile
        label="Threads"
        :value="threads === null ? '—' : threads.toLocaleString()"
        :values="threadValues"
        :live="live"
        @open="openPerformance"
      />
    </div>
  </section>
</template>
