<script setup lang="ts" generic="Id extends string">
import { ref } from "vue";
import SortHeader from "@/shared/components/presentation/SortHeader.vue";
import type { ListColumn } from "./listColumns";

/**
 * The header row of a Network list: one cell per shown column on the shared grid template,
 * sortable labels, and a drag handle on the edge each column resizes from (a double-click puts
 * the column back to its default width). It exposes its element so the layout measures it.
 */
const props = defineProps<{
  columns: readonly ListColumn<Id>[];
  edgeOf: (id: Id) => "start" | "end" | null;
  /** Sort state per column; `null` for a column that does not sort. */
  sortOf?: (id: Id) => "asc" | "desc" | false | null;
  resizing: Id | null;
}>();

const emit = defineEmits<{
  sort: [id: Id];
  resizeStart: [id: Id, event: PointerEvent];
  resetWidth: [id: Id];
}>();

defineSlots<{ extra?: (props: { column: ListColumn<Id> }) => unknown }>();

const root = ref<HTMLElement | null>(null);

function sortState(id: Id): "asc" | "desc" | false | null {
  return props.sortOf ? props.sortOf(id) : null;
}

defineExpose({ root });
</script>

<template>
  <div
    ref="root"
    class="grid h-8 shrink-0 items-center overflow-hidden border-b border-border-subtle px-2 [grid-template-columns:var(--list-cols)] [scrollbar-gutter:stable]"
  >
    <span
      v-for="column in props.columns"
      :key="column.id"
      class="relative flex h-full min-w-0 items-center px-2"
      :class="column.align === 'end' ? 'justify-end' : 'justify-start'"
    >
      <slot name="extra" :column="column" />
      <template v-if="!column.action">
        <SortHeader
          v-if="sortState(column.id) !== null"
          :label="column.label"
          :state="sortState(column.id) ?? false"
          :align="column.align"
          class="relative w-full"
          @toggle="emit('sort', column.id)"
        />
        <span v-else class="truncate text-2xs text-muted-foreground">{{ column.label }}</span>
      </template>
      <span
        v-if="props.edgeOf(column.id)"
        role="separator"
        aria-orientation="vertical"
        :aria-label="`Resize ${column.label}`"
        class="absolute top-0 z-10 h-full w-2 cursor-col-resize touch-none after:absolute after:inset-y-2 after:left-1/2 after:w-px after:-translate-x-1/2 after:rounded-full after:bg-border-subtle after:transition-colors after:duration-120 hover:after:bg-border"
        :class="[
          props.edgeOf(column.id) === 'end' ? '-right-1' : '-left-1',
          props.resizing === column.id && 'after:bg-ring hover:after:bg-ring',
        ]"
        @pointerdown.stop.prevent="emit('resizeStart', column.id, $event)"
        @dblclick.stop="emit('resetWidth', column.id)"
      />
    </span>
  </div>
</template>
