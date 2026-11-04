<script setup lang="ts">
import { computed } from "vue";
import { formatAggregate } from "./aggregates";
import type { GridSummary } from "./types";

const props = defineProps<{
  summary: GridSummary;
  /** Total rows in the source when the grid shows one page of it. */
  total?: number | null;
}>();

defineSlots<{ default?: () => unknown }>();

const count = computed(() => {
  const shown = props.summary.rowCount.toLocaleString("en-US");
  if (props.total === undefined || props.total === null || props.total === props.summary.rowCount) {
    return `${shown} ${props.summary.rowCount === 1 ? "row" : "rows"}`;
  }
  return `${shown} of ${props.total.toLocaleString("en-US")} rows`;
});

const selection = computed(() => {
  const { selectedRows, selectedCells } = props.summary;
  if (selectedRows === 0) return null;
  if (selectedCells <= 1) return `${selectedRows} selected`;
  return `${selectedRows} × ${selectedCells / selectedRows} selected`;
});

const numbers = computed(() => {
  const numeric = props.summary.aggregate?.numeric;
  if (!numeric || numeric.count < 2) return null;
  return [
    ["Σ", formatAggregate(numeric.sum)],
    ["avg", formatAggregate(numeric.avg)],
    ["min", formatAggregate(numeric.min)],
    ["max", formatAggregate(numeric.max)],
  ] as const;
});
</script>

<template>
  <div
    class="flex h-7 shrink-0 items-center gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg-chrome)] px-3 font-mono text-2xs text-muted-foreground"
    role="status"
    aria-live="polite"
  >
    <span class="tabular-nums">{{ count }}</span>
    <span v-if="selection" class="tabular-nums text-foreground">{{ selection }}</span>
    <span v-if="summary.aggregate && summary.aggregate.nulls > 0" class="tabular-nums">
      {{ summary.aggregate.nulls }} null
    </span>
    <span v-for="[label, value] in numbers ?? []" :key="label" class="tabular-nums">
      <span class="text-[var(--fg-subtle)]">{{ label }}</span> {{ value }}
    </span>
    <span class="flex-1" />
    <slot />
  </div>
</template>
