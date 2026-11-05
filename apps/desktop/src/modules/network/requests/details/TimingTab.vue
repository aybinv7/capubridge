<script setup lang="ts">
import { computed } from "vue";
import type { NetworkEntry } from "@/types/network.types";
import { durationMs, formatMs } from "../requestCells";
import KeyValueList, { type KeyValueRow } from "./KeyValueList.vue";
import { timingBreakdown, type TimingPhaseId } from "./timing";

const props = defineProps<{ entry: NetworkEntry }>();

const PHASE_SHADE: Record<TimingPhaseId, string> = {
  queued: "bg-[var(--fg-subtle)]/40",
  stalled: "bg-[var(--fg-subtle)]/60",
  dns: "bg-cat-network/45",
  connect: "bg-cat-network/55",
  ssl: "bg-cat-network/65",
  send: "bg-cat-network/75",
  wait: "bg-cat-network/40",
  download: "bg-cat-network",
};

const breakdown = computed(() => timingBreakdown(props.entry));

const phases = computed(() => {
  const value = breakdown.value;
  if (!value || value.total <= 0) return [];
  return value.phases.map((phase) => ({
    ...phase,
    left: (phase.start / value.total) * 100,
    width: Math.max(0.6, (phase.duration / value.total) * 100),
  }));
});

const facts = computed<KeyValueRow[]>(() => {
  const entry = props.entry;
  const ms = breakdown.value?.total ?? durationMs(entry);
  const rows: KeyValueRow[] = [
    { key: "Started at", value: new Date(entry.startedAt).toLocaleTimeString() },
  ];
  if (ms !== null) rows.push({ key: "Total", value: formatMs(ms) });
  return rows;
});
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="flex flex-col gap-5 p-4">
      <section v-if="phases.length" class="flex flex-col gap-2" aria-label="Where the time went">
        <div
          v-for="phase in phases"
          :key="phase.id"
          class="grid grid-cols-[9.5rem_minmax(0,1fr)_4.5rem] items-center gap-3"
        >
          <span class="truncate text-xs text-muted-foreground">{{ phase.label }}</span>
          <span class="relative h-2 rounded-inner bg-surface-cut shadow-cut" aria-hidden="true">
            <span
              class="absolute top-0 h-full rounded-inner"
              :class="PHASE_SHADE[phase.id]"
              :style="{
                left: `${phase.left}%`,
                width: `${Math.min(phase.width, 100 - phase.left)}%`,
              }"
            />
          </span>
          <span class="text-right font-mono text-2xs text-foreground tabular-nums">
            {{ formatMs(phase.duration) }}
          </span>
        </div>
      </section>
      <p v-else class="text-xs text-[var(--fg-subtle)]">
        {{
          props.entry.state === "pending" ? "Phases appear with the response" : "No phases reported"
        }}
      </p>
      <KeyValueList :rows="facts" />
    </div>
  </div>
</template>
