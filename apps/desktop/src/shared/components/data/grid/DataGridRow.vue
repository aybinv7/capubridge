<script setup lang="ts">
import { computed } from "vue";
import { formatCell, type CellKind } from "./valueFormat";
import type { GridColumn, GridRow, GridRowState } from "./types";

export interface VisibleColumn {
  column: GridColumn;
  index: number;
  width: number;
}

const props = defineProps<{
  gridId: string;
  row: GridRow;
  index: number;
  rowNumber: number;
  columns: readonly VisibleColumn[];
  leadingSpace: number;
  gutterWidth: number;
  state?: GridRowState;
  rowSelected: boolean;
  focusCol: number | null;
  rangeCols: readonly [number, number] | null;
}>();

const KIND_CLASS: Record<CellKind, string> = {
  null: "italic text-[var(--fg-subtle)]",
  boolean: "text-signal-select",
  number: "tabular-nums text-foreground",
  string: "text-foreground",
  json: "text-foreground",
  date: "tabular-nums text-foreground",
  blob: "text-cat-storage",
};

const STATE_CLASS: Record<GridRowState, string> = {
  "staged-edit": "bg-[color-mix(in_oklab,var(--signal-mark)_9%,transparent)]",
  "staged-insert": "bg-[color-mix(in_oklab,var(--state-success)_9%,transparent)]",
  "staged-delete":
    "bg-[color-mix(in_oklab,var(--state-danger)_9%,transparent)] text-[var(--fg-subtle)] line-through",
  conflict: "prov-stale",
  recent: "bg-[color-mix(in_oklab,var(--signal-select)_10%,transparent)]",
};

const STATE_BAR: Record<GridRowState, string> = {
  "staged-edit": "bg-signal-mark",
  "staged-insert": "bg-success",
  "staged-delete": "bg-error",
  conflict: "bg-error",
  recent: "bg-signal-select",
};

const cells = computed(() =>
  props.columns.map((entry) => ({
    ...entry,
    formatted: formatCell(props.row.cells[entry.column.id], entry.column.type),
  })),
);

function inRange(col: number): boolean {
  return props.rangeCols !== null && col >= props.rangeCols[0] && col <= props.rangeCols[1];
}
</script>

<template>
  <div
    role="row"
    :aria-rowindex="index + 2"
    :aria-selected="rowSelected || undefined"
    class="group/row flex w-full border-b border-[var(--border-subtle)] font-mono text-xs"
    :class="[
      state ? STATE_CLASS[state] : '',
      rowSelected ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--bg-surface-raised)]/50',
    ]"
  >
    <div
      role="rowheader"
      :data-gutter="index"
      class="sticky left-0 z-10 flex shrink-0 cursor-default items-center justify-end border-r border-[var(--border-subtle)] bg-[var(--bg-chrome)] pr-2 text-2xs tabular-nums text-[var(--fg-subtle)] select-none"
      :class="rowSelected && 'text-foreground'"
      :style="{ width: `${gutterWidth}px` }"
    >
      <span
        v-if="state"
        class="absolute inset-y-0 left-0 w-0.5"
        :class="STATE_BAR[state]"
        :title="state.replace('-', ' ')"
      />
      {{ rowNumber }}
    </div>
    <div v-if="leadingSpace > 0" class="shrink-0" :style="{ width: `${leadingSpace}px` }" />
    <div
      v-for="cell in cells"
      :id="`${gridId}-r${index}-c${cell.index}`"
      :key="cell.column.id"
      role="gridcell"
      :aria-colindex="cell.index + 2"
      :aria-selected="inRange(cell.index) || undefined"
      :data-row="index"
      :data-col="cell.index"
      class="relative flex shrink-0 cursor-default items-center gap-1.5 overflow-hidden border-r border-[var(--border-subtle)] px-2"
      :class="[
        cell.formatted.align === 'end' ? 'justify-end' : '',
        inRange(cell.index) && 'bg-[color-mix(in_oklab,var(--signal-select)_14%,transparent)]',
        focusCol === cell.index &&
          'outline outline-1 -outline-offset-1 outline-[var(--signal-select)]',
      ]"
      :style="{ width: `${cell.width}px` }"
    >
      <span
        v-if="cell.formatted.badge"
        class="shrink-0 rounded-sm bg-[var(--bg-surface-cut)] px-1 text-2xs leading-4 text-[var(--fg-subtle)]"
        >{{ cell.formatted.badge }}</span
      >
      <span dir="auto" class="truncate" :class="KIND_CLASS[cell.formatted.kind]">{{
        cell.formatted.text
      }}</span>
    </div>
  </div>
</template>
