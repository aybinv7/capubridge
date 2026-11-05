<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementSize } from "@vueuse/core";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import { chunkRows, columnsFor, scrollTopToReveal } from "@/shared/list/grid";
import { optionId, rowStateClass } from "@/shared/list/rowState";
import FileGlyph from "./FileGlyph.vue";
import { formatSizeLabel } from "./fileKinds";
import type { DeviceFileListEntry } from "./filePaths";
import { FILE_TILE } from "./filesView";

const PADDING = 12;

const props = defineProps<{
  entries: readonly DeviceFileListEntry[];
  selected: string | null;
  listId: string;
}>();

const emit = defineEmits<{
  select: [entry: DeviceFileListEntry];
  open: [entry: DeviceFileListEntry];
  menu: [entry: DeviceFileListEntry];
}>();

const scroller = ref<HTMLElement | null>(null);
const { width } = useElementSize(scroller);
const columnCount = computed(() => columnsFor(width.value, FILE_TILE.width));
const rows = computed(() => chunkRows(props.entries, columnCount.value));
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(rows, scroller, {
  itemHeight: FILE_TILE.height,
  overscan: 3,
});

/** Scrolls the tile at `index` into view. */
function reveal(index: number) {
  const element = scroller.value;
  if (!element || index < 0) return;
  element.scrollTop = scrollTopToReveal(
    Math.floor(index / columnCount.value),
    FILE_TILE.height,
    element.scrollTop,
    element.clientHeight,
    PADDING,
  );
}

function onClick(event: MouseEvent, entry: DeviceFileListEntry) {
  if (event.detail > 1) return;
  emit("select", entry);
}

/** Whether the tile of `path` is rendered, so it can be the active descendant. */
function isRendered(path: string): boolean {
  return items.value.some((row) => row.data.some((entry) => entry.path === path));
}

defineExpose({ reveal, isRendered, columns: () => columnCount.value });
</script>

<template>
  <div ref="scroller" class="h-full overflow-y-auto" :style="{ padding: `${PADDING}px` }">
    <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
    <div
      v-for="row in items"
      :key="row.index"
      class="grid"
      :style="{
        height: `${FILE_TILE.height}px`,
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
      }"
    >
      <div
        v-for="entry in row.data"
        :id="optionId(props.listId, entry.path)"
        :key="entry.path"
        role="option"
        :aria-selected="entry.path === props.selected"
        class="m-0.5 flex min-w-0 cursor-default flex-col items-center justify-start gap-1.5 rounded-well px-2 pt-3"
        :class="rowStateClass(entry.path === props.selected)"
        :title="entry.path"
        @click="onClick($event, entry)"
        @dblclick="emit('open', entry)"
        @contextmenu="emit('menu', entry)"
      >
        <FileGlyph :entry="entry" :size="32" />
        <span
          class="line-clamp-2 h-8 w-full text-center text-xs leading-4 [overflow-wrap:anywhere] text-foreground"
        >
          {{ entry.name }}
        </span>
        <span class="text-2xs text-[var(--fg-subtle)] tabular-nums">{{
          formatSizeLabel(entry)
        }}</span>
      </div>
    </div>
    <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
  </div>
</template>
