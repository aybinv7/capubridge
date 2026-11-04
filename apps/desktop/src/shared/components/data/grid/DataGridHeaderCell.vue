<script setup lang="ts">
import { computed } from "vue";
import {
  ArrowDown,
  ArrowUp,
  Binary,
  Braces,
  Calendar,
  CircleDashed,
  Hash,
  KeyRound,
  Link2,
  ToggleLeft,
  Type,
} from "lucide-vue-next";
import type { GridColumn, GridColumnType } from "./types";

const props = defineProps<{
  column: GridColumn;
  width: number;
  sort: "asc" | "desc" | null;
  sortable: boolean;
}>();

const emit = defineEmits<{
  sort: [];
  resizeStart: [event: PointerEvent];
  autosize: [];
}>();

const TYPE_ICONS: Record<GridColumnType, typeof Hash> = {
  integer: Hash,
  real: Hash,
  text: Type,
  boolean: ToggleLeft,
  json: Braces,
  date: Calendar,
  blob: Binary,
  key: KeyRound,
  unknown: CircleDashed,
};

const icon = computed(() => TYPE_ICONS[props.column.type ?? "unknown"]);

const tooltip = computed(() => {
  const parts = [props.column.title];
  if (props.column.typeLabel) parts.push(props.column.typeLabel);
  if (props.column.primaryKey) parts.push("primary key");
  if (props.column.foreignKey) parts.push(`→ ${props.column.foreignKey}`);
  if (props.column.notNull) parts.push("not null");
  return parts.join(" · ");
});

const ariaSort = computed(() => {
  if (props.sort === "asc") return "ascending";
  if (props.sort === "desc") return "descending";
  return "none";
});
</script>

<template>
  <div
    role="columnheader"
    :aria-sort="ariaSort"
    class="group/header relative flex h-full shrink-0 items-center border-r border-[var(--border-subtle)]"
    :style="{ width: `${width}px` }"
    :title="tooltip"
  >
    <button
      type="button"
      tabindex="-1"
      class="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 text-left text-xs font-medium text-foreground"
      :class="sortable ? 'cursor-pointer hover:bg-[var(--bg-surface-raised)]' : 'cursor-default'"
      @click="sortable && emit('sort')"
    >
      <component
        :is="column.primaryKey ? KeyRound : icon"
        :size="12"
        class="shrink-0"
        :class="column.primaryKey ? 'text-signal-mark' : 'text-[var(--fg-subtle)]'"
        aria-hidden="true"
      />
      <span class="truncate">{{ column.title }}</span>
      <Link2
        v-if="column.foreignKey"
        :size="11"
        class="shrink-0 text-signal-select"
        aria-label="foreign key"
      />
      <span class="flex-1" />
      <ArrowUp v-if="sort === 'asc'" :size="12" class="shrink-0 text-foreground" />
      <ArrowDown v-else-if="sort === 'desc'" :size="12" class="shrink-0 text-foreground" />
    </button>
    <span
      role="separator"
      aria-orientation="vertical"
      :aria-label="`Resize ${column.title}`"
      class="absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize after:absolute after:inset-y-1.5 after:left-1/2 after:w-px after:bg-transparent hover:after:bg-signal-select"
      @pointerdown.stop.prevent="emit('resizeStart', $event)"
      @dblclick.stop="emit('autosize')"
    />
  </div>
</template>
