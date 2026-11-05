<script setup lang="ts">
import { computed, ref } from "vue";
import {
  getCoreRowModel,
  useVueTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/vue-table";
import { Download, Trash2 } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import SortHeader from "../shared/SortHeader.vue";
import { scrollTopToReveal } from "../shared/grid";
import FileGlyph from "./FileGlyph.vue";
import { formatSize } from "./fileKinds";
import {
  isFolderEntry,
  type DeviceFileListEntry,
  type FileSort,
  type FileSortKey,
} from "./filePaths";
import { FILE_ROW_HEIGHT } from "./filesView";

const HEADER_HEIGHT = 30;
const COLUMNS = "grid-cols-[minmax(0,1fr)_6rem_10rem_4rem]";

const props = defineProps<{
  entries: readonly DeviceFileListEntry[];
  selected: string | null;
  sizesKnown: boolean;
}>();

const sort = defineModel<FileSort>("sort", { required: true });

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
const sorting = computed<SortingState>(() => [{ id: sort.value.key, desc: sort.value.desc }]);
const table = useVueTable({
  get data() {
    return props.entries as DeviceFileListEntry[];
  },
  columns,
  manualSorting: true,
  state: {
    get sorting() {
      return sorting.value;
    },
  },
  getCoreRowModel: getCoreRowModel(),
});

const rows = computed(() => table.getRowModel().rows.map((row) => row.original));
const scroller = ref<HTMLElement | null>(null);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(rows, scroller, {
  itemHeight: FILE_ROW_HEIGHT,
  overscan: 10,
});

function sortState(id: FileSortKey): "asc" | "desc" | false {
  return sort.value.key === id ? (sort.value.desc ? "desc" : "asc") : false;
}

function toggle(id: FileSortKey) {
  sort.value = { key: id, desc: sort.value.key === id ? !sort.value.desc : false };
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
    HEADER_HEIGHT,
  );
}

defineExpose({ reveal, columns: () => 1 });
</script>

<template>
  <div ref="scroller" class="h-full overflow-y-auto">
    <div
      class="sticky top-0 z-10 grid items-center gap-3 border-b border-border-subtle bg-card px-4"
      :class="COLUMNS"
      :style="{ height: `${HEADER_HEIGHT}px` }"
    >
      <SortHeader label="Name" :state="sortState('name')" @toggle="toggle('name')" />
      <SortHeader label="Size" :state="sortState('size')" align="end" @toggle="toggle('size')" />
      <SortHeader label="Modified" :state="sortState('modified')" @toggle="toggle('modified')" />
      <span />
    </div>
    <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
    <div
      v-for="item in items"
      :key="item.data.path"
      role="option"
      :aria-selected="item.data.path === props.selected"
      class="group/row mx-1.5 grid cursor-default items-center gap-3 rounded-control px-2.5 text-xs"
      :class="[
        COLUMNS,
        item.data.path === props.selected
          ? 'bg-cladd-surface-next shadow-bevel'
          : 'hover:bg-cladd-surface-hover',
      ]"
      :style="{ height: `${FILE_ROW_HEIGHT}px` }"
      @click="emit('select', item.data)"
      @dblclick="emit('open', item.data)"
      @contextmenu="emit('menu', item.data)"
    >
      <span class="flex min-w-0 items-center gap-2">
        <FileGlyph :entry="item.data" />
        <span class="truncate text-foreground" :title="item.data.path">{{ item.data.name }}</span>
      </span>
      <span class="text-right font-mono text-2xs text-muted-foreground tabular-nums">
        {{
          isFolderEntry(item.data)
            ? "—"
            : props.sizesKnown || item.data.size > 0
              ? formatSize(item.data.size)
              : "Unknown"
        }}
      </span>
      <span class="truncate font-mono text-2xs text-muted-foreground" :title="item.data.modified">
        {{ item.data.modified === "—" ? "Unknown" : item.data.modified }}
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
          @click="emit('download', item.data)"
        >
          <Download :stroke-width="1.8" />
        </IconAction>
        <IconAction label="Delete" size="sm" @click="emit('delete', item.data)">
          <Trash2 :stroke-width="1.8" />
        </IconAction>
      </span>
    </div>
    <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
  </div>
</template>
