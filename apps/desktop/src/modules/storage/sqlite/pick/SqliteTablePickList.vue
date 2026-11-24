<script setup lang="ts">
import { computed, ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { Checkbox } from "@capubridge/cladd";
import type { SqliteTableInfo } from "@/types/sqlite.types";

const ROW_HEIGHT = 30;

const props = defineProps<{
  tables: readonly SqliteTableInfo[];
  picked: ReadonlySet<string>;
  /** Why a table cannot be picked for this change, or `null`. */
  blockedReason: (table: SqliteTableInfo) => string | null;
}>();

const emit = defineEmits<{ toggle: [name: string, picked: boolean] }>();

const scrollRef = ref<HTMLElement | null>(null);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.tables.length,
    getScrollElement: () => scrollRef.value,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index: number) => props.tables[index]?.name ?? index,
    overscan: 10,
  })),
);

const visible = computed(() =>
  virtualizer.value.getVirtualItems().flatMap((virtual) => {
    const table = props.tables[virtual.index];
    return table ? [{ key: String(virtual.key), start: virtual.start, table }] : [];
  }),
);

const rows = (value: number) => value.toLocaleString("en-US");
</script>

<template>
  <div
    ref="scrollRef"
    class="h-72 overflow-y-auto overscroll-contain rounded-inner bg-surface-cut shadow-cut"
    role="group"
    aria-label="Tables"
  >
    <p
      v-if="props.tables.length === 0"
      class="flex h-full items-center justify-center text-xs text-muted-foreground"
    >
      No table matches.
    </p>
    <div v-else :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
      <label
        v-for="item in visible"
        :key="item.key"
        class="absolute inset-x-0 flex items-center gap-2.5 px-3 text-xs"
        :class="
          props.blockedReason(item.table)
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer hover:bg-cladd-surface-hover'
        "
        :style="{ top: `${item.start}px`, height: `${ROW_HEIGHT}px` }"
        :title="props.blockedReason(item.table) ?? undefined"
      >
        <Checkbox
          size="sm"
          :checked="props.picked.has(item.table.name)"
          :disabled="props.blockedReason(item.table) !== null"
          @update:checked="emit('toggle', item.table.name, $event)"
        />
        <span class="min-w-0 flex-1 truncate font-mono text-foreground">{{ item.table.name }}</span>
        <span
          v-if="item.table.tableType === 'view'"
          class="shrink-0 rounded-control px-1.5 text-2xs text-muted-foreground shadow-cut"
        >
          view
        </span>
        <span v-else class="shrink-0 font-mono text-2xs text-muted-foreground tabular-nums">
          {{ rows(item.table.rowCount) }} {{ item.table.rowCount === 1 ? "row" : "rows" }}
        </span>
      </label>
    </div>
  </div>
</template>
