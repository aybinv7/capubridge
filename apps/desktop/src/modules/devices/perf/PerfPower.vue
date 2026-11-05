<script setup lang="ts">
import { computed } from "vue";
import { BatteryCharging, Thermometer } from "lucide-vue-next";
import type { PerfMetrics } from "@/types/perf.types";
import PerfCard from "./PerfCard.vue";
import { batteryTone } from "./perfView";

const props = defineProps<{ metrics: PerfMetrics | null }>();

const battery = computed(() => props.metrics?.battery ?? null);
const level = computed(() => battery.value?.level ?? null);
const chargingWord = computed(() => {
  const charging = battery.value?.charging;
  if (charging === true) return "Charging";
  if (charging === false) return "On battery";
  return "Charging state unknown";
});
const cpuTemp = computed(() => props.metrics?.cpuTemp ?? null);
const tempSource = computed(() => props.metrics?.cpuTempSource?.replace(/[-_]/g, " ") ?? null);
const batteryTemp = computed(() => battery.value?.temperature ?? null);
</script>

<template>
  <PerfCard
    title="Battery"
    :value="level === null ? '—' : `${level}%`"
    :value-class="batteryTone(level)"
    :detail="chargingWord"
  >
    <template #icon><BatteryCharging :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
    <div
      class="h-1.5 overflow-hidden rounded-full bg-surface-cut shadow-cut"
      role="meter"
      aria-label="Battery level"
      :aria-valuenow="level ?? undefined"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="h-full rounded-full transition-[width] duration-200 ease-in-out"
        :class="
          level !== null && level < 40 ? `bg-current ${batteryTone(level)}` : 'bg-muted-foreground'
        "
        :style="{ width: `${level ?? 0}%` }"
      />
    </div>
    <dl class="mt-auto grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
      <dt class="flex items-center gap-1.5 text-muted-foreground">
        <Thermometer :size="12" :stroke-width="1.8" aria-hidden="true" />
        Processor
      </dt>
      <dd class="text-right font-mono text-foreground tabular-nums">
        <span v-if="cpuTemp !== null" :title="tempSource ? `Read from ${tempSource}` : undefined">
          {{ cpuTemp.toFixed(1) }} °C
        </span>
        <span v-else class="font-sans text-[var(--fg-subtle)]">Not exposed by this phone</span>
      </dd>
      <dt class="pl-[18px] text-muted-foreground">Battery</dt>
      <dd class="text-right font-mono text-foreground tabular-nums">
        {{ batteryTemp === null ? "—" : `${batteryTemp.toFixed(1)} °C` }}
      </dd>
    </dl>
  </PerfCard>
</template>
