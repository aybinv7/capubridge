<script setup lang="ts">
import { computed, ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { rowHeight, scrollTargetIndex, type PaletteRow as Row } from "@/lib/commands/palette/rows";
import PaletteRow from "./PaletteRow.vue";

const props = defineProps<{
  rows: readonly Row[];
  highlighted: string | null;
  listId: string;
}>();

const emit = defineEmits<{
  hover: [key: string];
  choose: [key: string];
}>();

const scrollRef = ref<HTMLElement | null>(null);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.rows.length,
    getScrollElement: () => scrollRef.value,
    estimateSize: (index: number) => {
      const row = props.rows[index];
      return row ? rowHeight(row) : 0;
    },
    getItemKey: (index: number) => props.rows[index]?.key ?? index,
    overscan: 8,
    paddingStart: 8,
    paddingEnd: 8,
  })),
);

const visible = computed(() =>
  virtualizer.value.getVirtualItems().flatMap((virtual) => {
    const row = props.rows[virtual.index];
    return row
      ? [
          {
            key: String(virtual.key),
            index: virtual.index,
            start: virtual.start,
            size: virtual.size,
            row,
          },
        ]
      : [];
  }),
);

function optionIdAt(index: number): string {
  return `${props.listId}-${index}`;
}

/** The DOM id of the row with `key`, for `aria-activedescendant`; empty when it is not listed. */
function optionIdOf(key: string | null): string | undefined {
  if (key === null) return undefined;
  const index = props.rows.findIndex((row) => row.key === key);
  return index >= 0 ? optionIdAt(index) : undefined;
}

/** Brings the highlighted row into view, with its section header when it opens a section. */
function revealHighlighted() {
  const index = scrollTargetIndex(props.rows, props.highlighted);
  if (index >= 0) virtualizer.value.scrollToIndex(index, { align: "auto" });
}

defineExpose({ revealHighlighted, optionIdOf });
</script>

<template>
  <div
    :id="listId"
    ref="scrollRef"
    role="listbox"
    aria-label="Results"
    class="max-h-[440px] overflow-y-auto overscroll-contain"
  >
    <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
      <div
        v-for="entry in visible"
        :key="entry.key"
        class="absolute inset-x-2 top-0"
        :style="{ height: `${entry.size}px`, transform: `translateY(${entry.start}px)` }"
      >
        <p
          v-if="entry.row.type === 'header'"
          class="flex h-full items-end px-2.5 pb-1 text-2xs text-[var(--fg-subtle)]"
        >
          {{ entry.row.label }}
        </p>
        <div
          v-else
          :id="optionIdAt(entry.index)"
          role="option"
          :aria-selected="entry.row.key === highlighted"
          class="h-full"
          @pointermove="emit('hover', entry.row.key)"
          @click="emit('choose', entry.row.key)"
        >
          <PaletteRow :item="entry.row.item" :highlighted="entry.row.key === highlighted" />
        </div>
      </div>
    </div>
  </div>
</template>
