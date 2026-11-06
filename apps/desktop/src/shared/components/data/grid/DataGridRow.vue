<script setup lang="ts">
import { computed } from "vue";
import { formatCell, type CellKind } from "./valueFormat";
import type { GridRow, GridRowState, VisibleColumn } from "./types";

const props = defineProps<{
  gridId: string;
  row: GridRow;
  index: number;
  rowNumber: number;
  pinnedLeft: readonly VisibleColumn[];
  columns: readonly VisibleColumn[];
  pinnedRight: readonly VisibleColumn[];
  leadingSpace: number;
  gutterWidth: number;
  state?: GridRowState;
  rowSelected: boolean;
  focusCol: number | null;
  rangeCols: readonly [number, number] | null;
  /** Display index of the cell an inline editor is open on, in this row. */
  editingCol?: number | null;
}>();

defineSlots<{ editor?: () => unknown }>();

/** Cladd table typography: sans text, tabular numbers, mono only where shape matters. */
const KIND_CLASS: Record<CellKind, string> = {
  null: "italic text-cladd-fg-softer",
  boolean: "font-mono text-cladd-fg-soft",
  number: "tabular-nums text-cladd-fg",
  string: "text-cladd-fg",
  json: "font-mono text-cladd-fg-soft",
  date: "font-mono tabular-nums text-cladd-fg-soft",
  blob: "font-mono text-cat-storage",
};

const STATE_TINT: Record<GridRowState, string> = {
  "staged-edit": "bg-[color-mix(in_oklab,var(--signal-mark)_10%,transparent)]",
  "staged-insert": "bg-[color-mix(in_oklab,var(--state-success)_10%,transparent)]",
  "staged-delete":
    "bg-[color-mix(in_oklab,var(--state-danger)_10%,transparent)] text-cladd-fg-softer line-through",
  conflict: "prov-stale",
  recent: "bg-[color-mix(in_oklab,var(--signal-select)_10%,transparent)]",
  added: "bg-[color-mix(in_oklab,var(--state-success)_9%,transparent)]",
  updated: "bg-[color-mix(in_oklab,var(--state-warning)_9%,transparent)]",
  deleted: "text-cladd-fg-softer line-through opacity-75",
};

const STATE_BAR: Record<GridRowState, string> = {
  "staged-edit": "bg-signal-mark",
  "staged-insert": "bg-success",
  "staged-delete": "bg-error",
  conflict: "bg-error",
  recent: "bg-signal-select",
  added: "bg-success",
  updated: "bg-warning",
  deleted: "bg-error",
};

function format(entry: VisibleColumn) {
  const formatted = formatCell(props.row.cells[entry.column.id], entry.column.type);
  const keyLike = entry.column.primaryKey || entry.column.type === "key";
  return { ...entry, formatted, keyLike };
}

const left = computed(() => props.pinnedLeft.map(format));
const middle = computed(() => props.columns.map(format));
const right = computed(() => props.pinnedRight.map(format));

/** Sticky cells need an opaque fill that follows the row's own state. */
const stickyFill = computed(() =>
  props.rowSelected ? "bg-cladd-surface" : "bg-cladd-bg group-hover/row:bg-cladd-surface-hover",
);

function inRange(col: number): boolean {
  return props.rangeCols !== null && col >= props.rangeCols[0] && col <= props.rangeCols[1];
}

function cellClass(cell: ReturnType<typeof format>) {
  return [
    cell.formatted.align === "end" ? "justify-end" : "",
    cell.stick ? `sticky z-10 ${stickyFill.value}` : "",
    cell.stick?.side === "left" && cell === left.value[left.value.length - 1]
      ? "border-r border-cladd-outline"
      : "",
    cell.stick?.side === "right" && cell === right.value[0] ? "border-l border-cladd-outline" : "",
    inRange(cell.index) ? "bg-[color-mix(in_oklab,var(--cladd-primary)_9%,transparent)]" : "",
    props.focusCol === cell.index && props.editingCol !== cell.index
      ? "rounded-cladd-3xs shadow-[inset_0_0_0_1.5px_var(--cladd-primary)]"
      : "",
    props.editingCol === cell.index ? "z-40 overflow-visible px-0.5" : "",
  ];
}

function cellStyle(cell: ReturnType<typeof format>) {
  const style: Record<string, string> = { width: `${cell.width}px` };
  if (cell.stick) style[cell.stick.side] = `${cell.stick.offset}px`;
  return style;
}
</script>

<template>
  <div
    role="row"
    :aria-rowindex="index + 2"
    :aria-selected="rowSelected || undefined"
    class="group/row flex w-full border-b border-cladd-outline text-cladd-xs transition-colors duration-200"
    :class="[
      state ? STATE_TINT[state] : '',
      rowSelected ? 'bg-cladd-surface' : 'hover:bg-cladd-surface-hover',
    ]"
  >
    <div
      role="rowheader"
      :data-gutter="index"
      class="sticky left-0 z-20 flex shrink-0 cursor-default items-center justify-end border-r border-cladd-outline pr-2 text-cladd-2xs tabular-nums select-none"
      :class="[stickyFill, rowSelected ? 'text-cladd-fg' : 'text-cladd-fg-softer']"
      :style="{ width: `${gutterWidth}px` }"
    >
      <span
        v-if="state"
        class="absolute inset-y-1 left-0 w-0.5 rounded-full"
        :class="STATE_BAR[state]"
        :title="state.replace('-', ' ')"
      />
      {{ rowNumber }}
    </div>
    <div
      v-for="cell in left"
      :id="`${gridId}-r${index}-c${cell.index}`"
      :key="cell.column.id"
      role="gridcell"
      :aria-colindex="cell.index + 2"
      :aria-selected="inRange(cell.index) || undefined"
      :data-row="index"
      :data-col="cell.index"
      class="relative flex shrink-0 cursor-default items-center gap-1.5 overflow-hidden px-2"
      :class="cellClass(cell)"
      :style="cellStyle(cell)"
    >
      <slot v-if="editingCol === cell.index" name="editor" />
      <template v-else>
        <span
          v-if="cell.formatted.badge"
          class="shrink-0 rounded-cladd-full-2xs bg-cladd-surface-next px-1.5 font-mono text-cladd-2xs leading-4 text-cladd-fg-soft"
          >{{ cell.formatted.badge }}</span
        >
        <span
          dir="auto"
          class="truncate"
          :class="[KIND_CLASS[cell.formatted.kind], cell.keyLike && 'font-mono']"
          :title="row.titles?.[cell.column.id]"
          >{{ cell.formatted.text }}</span
        >
      </template>
    </div>
    <div v-if="leadingSpace > 0" class="shrink-0" :style="{ width: `${leadingSpace}px` }" />
    <div
      v-for="cell in middle"
      :id="`${gridId}-r${index}-c${cell.index}`"
      :key="cell.column.id"
      role="gridcell"
      :aria-colindex="cell.index + 2"
      :aria-selected="inRange(cell.index) || undefined"
      :data-row="index"
      :data-col="cell.index"
      class="relative flex shrink-0 cursor-default items-center gap-1.5 overflow-hidden px-2"
      :class="cellClass(cell)"
      :style="cellStyle(cell)"
    >
      <slot v-if="editingCol === cell.index" name="editor" />
      <template v-else>
        <span
          v-if="cell.formatted.badge"
          class="shrink-0 rounded-cladd-full-2xs bg-cladd-surface-next px-1.5 font-mono text-cladd-2xs leading-4 text-cladd-fg-soft"
          >{{ cell.formatted.badge }}</span
        >
        <span
          dir="auto"
          class="truncate"
          :class="[KIND_CLASS[cell.formatted.kind], cell.keyLike && 'font-mono']"
          :title="row.titles?.[cell.column.id]"
          >{{ cell.formatted.text }}</span
        >
      </template>
    </div>
    <div v-if="right.length > 0" class="min-w-0 flex-1" />
    <div
      v-for="cell in right"
      :id="`${gridId}-r${index}-c${cell.index}`"
      :key="cell.column.id"
      role="gridcell"
      :aria-colindex="cell.index + 2"
      :aria-selected="inRange(cell.index) || undefined"
      :data-row="index"
      :data-col="cell.index"
      class="relative flex shrink-0 cursor-default items-center gap-1.5 overflow-hidden px-2"
      :class="cellClass(cell)"
      :style="cellStyle(cell)"
    >
      <slot v-if="editingCol === cell.index" name="editor" />
      <template v-else>
        <span
          v-if="cell.formatted.badge"
          class="shrink-0 rounded-cladd-full-2xs bg-cladd-surface-next px-1.5 font-mono text-cladd-2xs leading-4 text-cladd-fg-soft"
          >{{ cell.formatted.badge }}</span
        >
        <span
          dir="auto"
          class="truncate"
          :class="[KIND_CLASS[cell.formatted.kind], cell.keyLike && 'font-mono']"
          :title="row.titles?.[cell.column.id]"
          >{{ cell.formatted.text }}</span
        >
      </template>
    </div>
  </div>
</template>
