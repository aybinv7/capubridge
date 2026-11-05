<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { StatusDot } from "@capubridge/cladd";
import { formatBytes } from "@/shared/format/numbers";
import VitalTile from "@/shared/perf/VitalTile.vue";
import { useAppSession } from "../appSession";
import { coresWords, cpuDomain, formatCpu } from "../process/cpuFormat";

const router = useRouter();
const { process, phase: processState } = useAppSession();
const { phase, copy, mark } = processState;
const { paused, error } = process;

const sample = computed(() => process.latest.value);
const running = computed(() => sample.value?.running === true);
const live = computed(() => phase.value === "live");

const memory = computed(() =>
  running.value && sample.value?.memory ? formatBytes(sample.value.memory.totalPssKb * 1024) : "—",
);
const cpu = computed(() => (running.value ? (sample.value?.cpu?.totalPct ?? null) : null));
const threads = computed(() => (running.value ? (sample.value?.threads ?? null) : null));

const memoryValues = computed(() => process.values("pss"));
const cpuValues = computed(() => process.values("cpu"));
const threadValues = computed(() => process.values("threads"));
const cpuScale = computed(() => cpuDomain(cpuValues.value));
const hasThreads = computed(() => threadValues.value.some((value) => value !== null));

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
        :aria-description="phase === 'error' ? (error ?? undefined) : undefined"
        @click="paused ? process.resume() : process.retry()"
      >
        {{ paused ? "Resume" : "Try again" }}
      </button>
    </header>
    <div class="grid grid-cols-1 gap-3" :class="hasThreads ? '@lg:grid-cols-3' : '@lg:grid-cols-2'">
      <VitalTile
        label="Memory"
        :value="memory"
        :values="memoryValues"
        :live="live"
        @open="openPerformance"
      />
      <VitalTile
        label="Processor"
        :value="formatCpu(cpu)"
        :detail="coresWords(process.cores.value)"
        :values="cpuValues"
        :domain="cpuScale"
        :live="live"
        @open="openPerformance"
      />
      <VitalTile
        v-if="hasThreads"
        label="Threads"
        :value="threads === null ? '—' : threads.toLocaleString()"
        :values="threadValues"
        :live="live"
        @open="openPerformance"
      />
    </div>
  </section>
</template>
