<script setup lang="ts">
import { computed } from "vue";
import { BatteryCharging, Thermometer } from "lucide-vue-next";
import type { PerfMetrics } from "@/types/perf.types";
import Sparkline from "../shared/Sparkline.vue";
import PerfCard from "./PerfCard.vue";
import { seriesValues, type SeriesPoint } from "./perfSeries";
import { batteryTone } from "./perfView";

const PERCENT_DOMAIN = [0, 100] as const;

const props = defineProps<{
  metrics: PerfMetrics | null;
  /** Battery level about every 30 s, oldest first. */
  charge: readonly SeriesPoint[];
}>();

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
const chargeValues = computed(() => seriesValues(props.charge, "battery"));
const chargeKnown = computed(() =>
  props.charge.filter((point) => typeof point.battery === "number"),
);
const chargeChange = computed(() => {
  const first = chargeKnown.value[0];
  const last = chargeKnown.value.at(-1);
  if (!first || !last || first === last) return null;
  const delta = (last.battery ?? 0) - (first.battery ?? 0);
  const minutes = Math.max(1, Math.round((last.x - first.x) / 60_000));
  if (delta === 0) return `Steady for ${minutes} min`;
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)}% in ${minutes} min`;
});
</script>

<template>
  <PerfCard
    title="Battery and heat"
    :value="level === null ? '—' : `${level}%`"
    :value-class="batteryTone(level)"
    :detail="chargingWord"
  >
    <template #icon><BatteryCharging :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
    <div
      class="h-1.5 shrink-0 overflow-hidden rounded-full bg-surface-cut shadow-cut"
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
    <div class="flex min-h-16 flex-1 flex-col gap-1">
      <span class="flex items-baseline justify-between text-2xs text-muted-foreground">
        Charge, last hour
        <span class="tabular-nums">{{ chargeChange ?? "Collecting" }}</span>
      </span>
      <Sparkline
        v-if="chargeKnown.length > 1"
        :values="chargeValues"
        :domain="PERCENT_DOMAIN"
        class="min-h-10 flex-1 text-muted-foreground"
      />
      <p v-else class="text-2xs text-[var(--fg-subtle)]">
        A point every 30 seconds while this screen is open.
      </p>
    </div>
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
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
