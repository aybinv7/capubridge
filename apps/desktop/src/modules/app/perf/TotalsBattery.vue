<script setup lang="ts">
import { computed, ref } from "vue";
import { BatteryMedium, ChevronDown } from "lucide-vue-next";
import { Spinner } from "@capubridge/cladd";
import type { AppBatteryStats } from "@/types/app-inspector.types";
import PerfCard from "@/shared/perf/PerfCard.vue";
import { formatDuration } from "../usage/batterystats";
import UsageRow from "./UsageRow.vue";

const props = defineProps<{
  stats: AppBatteryStats | undefined;
  loading: boolean;
  error: unknown;
}>();

const showRaw = ref(false);

const processorTime = computed(() =>
  props.stats?.hasData ? props.stats.cpuUserMs + props.stats.cpuSystemMs : null,
);

function meter(ms: number): number {
  const total = processorTime.value ?? 0;
  return total > 0 ? Math.min(100, Math.max(0, (ms / total) * 100)) : 0;
}
</script>

<template>
  <PerfCard
    title="Battery use"
    :value="processorTime === null ? undefined : formatDuration(processorTime)"
    :detail="processorTime === null ? undefined : 'Processor time since the last full charge'"
  >
    <template #icon><BatteryMedium :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
    <div v-if="props.error" class="flex flex-col gap-0.5" role="alert">
      <p class="text-xs text-foreground">The phone did not send the battery counters.</p>
      <p class="font-mono text-2xs break-all text-error">{{ props.error }}</p>
    </div>
    <div
      v-else-if="props.loading && !props.stats"
      class="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <Spinner size="xs" />
      Reading the battery counters
    </div>
    <p v-else-if="!props.stats?.hasData" class="text-xs text-muted-foreground">
      No battery figures for this app since the last full charge.
    </p>
    <template v-else>
      <div class="flex flex-col">
        <UsageRow
          label="Processor, in the app's own code"
          :value="formatDuration(props.stats.cpuUserMs)"
          :meter="meter(props.stats.cpuUserMs)"
        />
        <UsageRow
          label="Processor, in the system for it"
          :value="formatDuration(props.stats.cpuSystemMs)"
          :meter="meter(props.stats.cpuSystemMs)"
        />
        <UsageRow
          v-if="props.stats.onScreenMs > 0"
          label="On screen"
          :value="formatDuration(props.stats.onScreenMs)"
        />
        <UsageRow
          v-if="props.stats.wakePartialMs > 0"
          label="Kept the phone awake"
          :value="formatDuration(props.stats.wakePartialMs)"
          hint="Time the app held partial wake locks, with the screen off"
        />
        <UsageRow
          v-if="props.stats.wakeFullMs > 0"
          label="Kept the screen on"
          :value="formatDuration(props.stats.wakeFullMs)"
          hint="Time the app held full wake locks"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <button
          type="button"
          class="flex items-center gap-1 self-start text-2xs text-muted-foreground hover:text-foreground"
          :aria-expanded="showRaw"
          @click="showRaw = !showRaw"
        >
          <ChevronDown
            :size="12"
            class="transition-transform duration-120"
            :class="showRaw ? 'rotate-180' : ''"
            aria-hidden="true"
          />
          {{ showRaw ? "Hide what the phone printed" : "Show what the phone printed" }}
        </button>
        <pre
          v-if="showRaw"
          class="max-h-64 overflow-auto rounded-control bg-surface-cut p-2.5 font-mono text-2xs whitespace-pre-wrap text-muted-foreground shadow-cut"
          >{{ props.stats.raw }}</pre
        >
      </div>
    </template>
  </PerfCard>
</template>
