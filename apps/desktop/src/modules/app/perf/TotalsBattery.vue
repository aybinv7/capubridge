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

const scale = computed(() =>
  Math.max(props.stats?.fgCpuTimeMs ?? 0, props.stats?.bgCpuTimeMs ?? 0, 1),
);

const processorTime = computed(() =>
  props.stats?.hasData ? props.stats.fgCpuTimeMs + props.stats.bgCpuTimeMs : null,
);

function meter(ms: number): number {
  return Math.min(100, Math.max(0, (ms / scale.value) * 100));
}
</script>

<template>
  <PerfCard
    title="Battery use"
    :value="processorTime === null ? undefined : formatDuration(processorTime)"
    :detail="processorTime === null ? undefined : 'Processor time since the last full charge'"
  >
    <template #icon><BatteryMedium :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
    <div
      v-if="props.loading && !props.stats"
      class="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <Spinner size="xs" />
      Reading the battery counters
    </div>
    <div v-else-if="props.error" class="flex flex-col gap-0.5" role="alert">
      <p class="text-xs text-foreground">The phone did not send the battery counters.</p>
      <p class="font-mono text-2xs break-all text-error">{{ props.error }}</p>
    </div>
    <div v-else-if="!props.stats?.hasData" class="flex flex-col gap-1">
      <p class="text-xs text-muted-foreground">The phone has no battery figures for this app.</p>
      <p class="text-2xs text-[var(--fg-subtle)]">
        They reset at every full charge, and some phones keep them private.
      </p>
    </div>
    <template v-else>
      <div class="flex flex-col">
        <UsageRow
          label="Processor, on screen"
          :value="formatDuration(props.stats.fgCpuTimeMs)"
          :meter="meter(props.stats.fgCpuTimeMs)"
        />
        <UsageRow
          label="Processor, in the background"
          :value="formatDuration(props.stats.bgCpuTimeMs)"
          :meter="meter(props.stats.bgCpuTimeMs)"
        />
        <UsageRow
          v-if="props.stats.wakelocksMs > 0"
          label="Kept the phone awake"
          :value="formatDuration(props.stats.wakelocksMs)"
          hint="Time the app held wake locks"
        />
      </div>
      <div v-if="props.stats.raw.trim()" class="flex flex-col gap-1.5">
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
