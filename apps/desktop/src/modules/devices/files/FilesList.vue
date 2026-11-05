<script setup lang="ts">
import { computed, ref } from "vue";
import { getCoreRowModel, useVueTable, type ColumnDef } from "@tanstack/vue-table";
import { Download, Trash2 } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import { scrollTopToReveal } from "../shared/grid";
import { optionId, rowStateClass } from "../shared/rowState";
import FileGlyph from "./FileGlyph.vue";
import { modifiedCell, sizeCell } from "./fileCells";
import { isFolderEntry, type DeviceFileListEntry } from "./filePaths";
import { FILE_LIST_COLUMNS, FILE_ROW_HEIGHT } from "./filesView";

const props = defineProps<{
  entries: readonly DeviceFileListEntry[];
  selected: string | null;
  sizesKnown: boolean;
  listId: string;
}>();

const emit = defineEmits<{
  select: [entry: DeviceFileListEntry];
  open: [entry: DeviceFileListEntry];
  menu: [entry: DeviceFileListEntry];
  download: [entry: DeviceFileListEntry];
  delete: [entry: DeviceFileListEntry];
}>();

const columns: ColumnDef<DeviceFileListEntry>[] = [
  { id: "name", accessorKey: "name" },
  { id: "size", accessorKey: "size" },
  { id: "modified", accessorKey: "modified" },
];
const table = useVueTable({
  get data() {
    return props.entries as DeviceFileListEntry[];
  },
  columns,
  manualSorting: true,
  getCoreRowModel: getCoreRowModel(),
});

const rows = computed(() => table.getRowModel().rows.map((row) => row.original));
const scroller = ref<HTMLElement | null>(null);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(rows, scroller, {
  itemHeight: FILE_ROW_HEIGHT,
  overscan: 10,
});

function onClick(event: MouseEvent, entry: DeviceFileListEntry) {
  if (event.detail > 1) return;
  emit("select", entry);
}

/** Scrolls row `index` into view. */
function reveal(index: number) {
  const element = scroller.value;
  if (!element || index < 0) return;
  element.scrollTop = scrollTopToReveal(
    index,
    FILE_ROW_HEIGHT,
    element.scrollTop,
    element.clientHeight,
  );
}

/** Whether the row of `path` is rendered, so it can be the active descendant. */
function isRendered(path: string): boolean {
  return items.value.some((item) => item.data.path === path);
}

defineExpose({ reveal, isRendered, columns: () => 1 });
</script>

<template>
  <div ref="scroller" class="h-full overflow-y-auto py-1">
    <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
    <div
      v-for="item in items"
      :id="optionId(props.listId, item.data.path)"
      :key="item.data.path"
      role="option"
      :aria-selected="item.data.path === props.selected"
      class="group/row mx-1.5 grid cursor-default items-center gap-3 rounded-control px-2.5 text-xs"
      :class="[FILE_LIST_COLUMNS, rowStateClass(item.data.path === props.selected)]"
      :style="{ height: `${FILE_ROW_HEIGHT}px` }"
      @click="onClick($event, item.data)"
      @dblclick="emit('open', item.data)"
      @contextmenu="emit('menu', item.data)"
    >
      <span class="flex min-w-0 items-center gap-2">
        <FileGlyph :entry="item.data" />
        <span
          class="truncate"
          :class="item.data.noAccess ? 'text-muted-foreground' : 'text-foreground'"
          :title="item.data.path"
        >
          {{ item.data.name }}
        </span>
      </span>
      <span class="text-right font-mono text-2xs text-muted-foreground tabular-nums">
        {{ sizeCell(item.data, props.sizesKnown) }}
      </span>
      <span
        class="truncate text-2xs"
        :class="item.data.noAccess ? 'text-[var(--fg-subtle)]' : 'text-muted-foreground'"
        :title="item.data.modified || undefined"
      >
        {{ modifiedCell(item.data) }}
      </span>
      <span
        class="flex justify-end gap-0.5 opacity-0 transition-opacity duration-120 group-hover/row:opacity-100"
        @click.stop
        @dblclick.stop
      >
        <IconAction
          v-if="!isFolderEntry(item.data)"
          label="Download"
          size="sm"
          tabindex="-1"
          @click="emit('download', item.data)"
        >
          <Download :stroke-width="1.8" />
        </IconAction>
        <IconAction label="Delete" size="sm" tabindex="-1" @click="emit('delete', item.data)">
          <Trash2 :stroke-width="1.8" />
        </IconAction>
      </span>
    </div>
    <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
  </div>
</template>
