<script setup lang="ts">
import { Spinner } from "@capubridge/cladd";
import type { GridNote } from "./types";

/** A full-width line inside a section: a read in progress, an error, or "show more". */
defineProps<{
  cellId: string;
  note: GridNote;
  index: number;
  gutterWidth: number;
  focused: boolean;
}>();
</script>

<template>
  <div
    role="row"
    :aria-rowindex="index + 2"
    :data-note-row="index"
    class="flex w-full cursor-default items-center border-b border-cladd-outline text-cladd-xs select-none"
    :class="[
      focused && 'shadow-[inset_0_0_0_1.5px_var(--cladd-primary)]',
      note.action && !note.busy && 'hover:bg-cladd-surface-hover',
    ]"
  >
    <div
      :id="cellId"
      role="gridcell"
      aria-colindex="1"
      class="sticky left-0 flex min-w-0 items-center gap-2 pr-3"
      :style="{ paddingLeft: `${gutterWidth + 8}px` }"
    >
      <Spinner v-if="note.busy" size="2xs" />
      <span
        class="truncate"
        :class="note.tone === 'error' ? 'text-error' : 'text-cladd-fg-soft'"
        :title="note.tone === 'error' ? note.text : undefined"
        >{{ note.text }}</span
      >
      <span
        v-if="note.action && !note.busy"
        data-note-action
        class="shrink-0 font-medium text-signal-select underline-offset-2 hover:underline"
        >{{ note.action }}</span
      >
    </div>
  </div>
</template>
