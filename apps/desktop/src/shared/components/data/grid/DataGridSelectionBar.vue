<script setup lang="ts">
import { Braces, ClipboardCopy, EyeOff, TableProperties, X } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";

/**
 * What can be done with a block of cells: it floats above the grid's foot while more than one
 * cell is picked. Whole columns can also be hidden from here.
 */
const props = defineProps<{
  rows: number;
  columns: number;
  /** The block spans every row, so the pick is whole columns. */
  wholeColumns: boolean;
}>();

const emit = defineEmits<{
  copy: [format: "tsv" | "json", withHeader: boolean];
  hide: [];
  clear: [];
}>();

const count = (value: number) => value.toLocaleString("en-US");
</script>

<template>
  <div
    class="cladd-surface-level-3 pointer-events-auto flex items-center gap-1 rounded-full bg-cladd-surface py-1 pr-1 pl-3 text-xs text-cladd-fg shadow-[var(--bevel-strong),var(--shadow-float)]"
    role="toolbar"
    aria-label="Selected cells"
  >
    <span class="mr-1 font-mono text-2xs text-muted-foreground tabular-nums">
      <template v-if="props.wholeColumns">
        {{ count(props.columns) }} {{ props.columns === 1 ? "column" : "columns" }}
      </template>
      <template v-else>{{ count(props.rows) }} × {{ count(props.columns) }}</template>
    </span>
    <Button
      size="xs"
      variant="transparent"
      :outline="false"
      content-class-name="gap-1.5"
      @click="emit('copy', 'tsv', false)"
    >
      <ClipboardCopy :size="12" aria-hidden="true" /> Copy
    </Button>
    <Button
      size="xs"
      variant="transparent"
      :outline="false"
      content-class-name="gap-1.5"
      @click="emit('copy', 'tsv', true)"
    >
      <TableProperties :size="12" aria-hidden="true" /> With headers
    </Button>
    <Button
      size="xs"
      variant="transparent"
      :outline="false"
      content-class-name="gap-1.5"
      @click="emit('copy', 'json', false)"
    >
      <Braces :size="12" aria-hidden="true" /> JSON
    </Button>
    <Button
      v-if="props.wholeColumns"
      size="xs"
      variant="transparent"
      :outline="false"
      content-class-name="gap-1.5"
      @click="emit('hide')"
    >
      <EyeOff :size="12" aria-hidden="true" />
      Hide {{ props.columns === 1 ? "column" : "columns" }}
    </Button>
    <IconAction label="Clear the selection" size="sm" @click="emit('clear')">
      <X :stroke-width="1.8" />
    </IconAction>
  </div>
</template>
