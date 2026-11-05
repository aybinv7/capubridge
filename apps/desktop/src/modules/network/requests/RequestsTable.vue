<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from "vue";
import { getCoreRowModel, useVueTable, type ColumnDef } from "@tanstack/vue-table";
import SortHeader from "@/shared/components/presentation/SortHeader.vue";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import { scrollTopToReveal } from "@/shared/list/grid";
import { optionId, rowStateClass } from "@/shared/list/rowState";
import type { NetworkEntry } from "@/types/network.types";
import RequestNameCell from "./RequestNameCell.vue";
import RequestWaterfall from "./RequestWaterfall.vue";
import WaterfallAxis from "./WaterfallAxis.vue";
import {
  REQUEST_COLUMNS,
  REQUEST_ROW_HEIGHT,
  columnDisplay,
  type RequestColumn,
} from "./requestColumns";
import { rowCells } from "./requestRowCells";
import { nextSort, type RequestSort } from "./requestSort";
import { waterfallBar, type WaterfallRange } from "./waterfall";

const props = defineProps<{
  entries: readonly NetworkEntry[];
  selectedId: string | null;
  range: WaterfallRange | null;
  showWaterfall: boolean;
  /** Changes when the filters change, so the selected row is brought back into view. */
  revealKey: string;
}>();

const sort = defineModel<RequestSort | null>("sort", { required: true });

const emit = defineEmits<{
  select: [entry: NetworkEntry];
  clear: [];
  menu: [entry: NetworkEntry | null];
  inspect: [];
}>();

const listId = useId();
const columnDefs: ColumnDef<NetworkEntry>[] = REQUEST_COLUMNS.map((column) => ({
  id: column.id,
  header: column.label,
  meta: column,
}));
const table = useVueTable({
  get data() {
    return props.entries as NetworkEntry[];
  },
  columns: columnDefs,
  manualSorting: true,
  state: {
    get columnVisibility() {
      return { waterfall: props.showWaterfall };
    },
  },
  getCoreRowModel: getCoreRowModel(),
});
const columns = computed(() => {
  void props.showWaterfall;
  return table.getVisibleLeafColumns().map((column) => column.columnDef.meta as RequestColumn);
});

const scroller = ref<HTMLElement | null>(null);
const source = computed(() => props.entries);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(source, scroller, {
  itemHeight: REQUEST_ROW_HEIGHT,
  overscan: 12,
});

const rows = computed(() => {
  const range = props.showWaterfall ? props.range : null;
  return items.value.map(({ data: entry }) => ({
    entry,
    id: optionId(listId, entry.requestId),
    cells: rowCells(entry),
    bar: range ? waterfallBar(entry, range) : null,
    failed: entry.state === "failed",
    selected: entry.requestId === props.selectedId,
  }));
});

const activeId = computed(() => rows.value.find((row) => row.selected)?.id);

function sortState(column: RequestColumn): "asc" | "desc" | false {
  if (sort.value?.key !== column.sortKey) return false;
  return sort.value.desc ? "desc" : "asc";
}

function toggleSort(column: RequestColumn) {
  sort.value = nextSort(sort.value, column.sortKey);
}

function reveal(index: number) {
  const element = scroller.value;
  if (!element || index < 0) return;
  element.scrollTop = scrollTopToReveal(
    index,
    REQUEST_ROW_HEIGHT,
    element.scrollTop,
    element.clientHeight,
  );
}

function revealSelected() {
  if (!props.selectedId) return;
  reveal(props.entries.findIndex((entry) => entry.requestId === props.selectedId));
}

/** Moves the selection by `step` rows (±Infinity for the ends) and keeps it in view. */
function move(step: number) {
  const list = props.entries;
  if (!list.length) return;
  const current = list.findIndex((entry) => entry.requestId === props.selectedId);
  const start = current < 0 ? (step > 0 ? -1 : list.length) : current;
  const next = Math.min(list.length - 1, Math.max(0, start + step));
  const entry = list[next];
  if (!entry) return;
  emit("select", entry);
  reveal(next);
}

function onKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const page = Math.max(1, Math.floor((scroller.value?.clientHeight ?? 0) / REQUEST_ROW_HEIGHT));
  const steps: Record<string, number> = {
    ArrowDown: 1,
    ArrowUp: -1,
    PageDown: page,
    PageUp: -page,
    Home: -Infinity,
    End: Infinity,
  };
  const step = steps[event.key];
  if (step !== undefined) {
    event.preventDefault();
    move(step);
  } else if (event.key === "Enter" && props.selectedId) {
    event.preventDefault();
    emit("inspect");
  } else if (event.key === "Escape" && props.selectedId) {
    event.preventDefault();
    emit("clear");
  }
}

function onClick(event: MouseEvent, entry: NetworkEntry) {
  if (event.detail > 1) return;
  emit("select", entry);
}

/** A context menu opened from the keyboard (Menu key, Shift+F10) acts on the selected row. */
function onListContextMenu(event: MouseEvent) {
  const onRow = event.target instanceof Element && event.target.closest("[role='option']");
  if (onRow) return;
  const selected = props.entries.find((entry) => entry.requestId === props.selectedId) ?? null;
  emit("menu", selected);
}

const FOLLOW_SLACK = REQUEST_ROW_HEIGHT * 2;
let following = true;

function onScroll() {
  const element = scroller.value;
  if (!element) return;
  following = element.scrollHeight - element.scrollTop - element.clientHeight <= FOLLOW_SLACK;
}

watch(
  () => props.entries[props.entries.length - 1]?.requestId,
  (last, previous) => {
    const element = scroller.value;
    if (!element || !last || last === previous) return;
    if (sort.value || props.selectedId || !following) return;
    element.scrollTop = element.scrollHeight;
  },
  { flush: "post" },
);

watch(() => props.revealKey, revealSelected, { flush: "post" });
onMounted(revealSelected);

defineExpose({ move, focus: () => scroller.value?.focus() });
</script>

<template>
  <div class="@container flex h-full min-h-0 flex-col">
    <div class="flex h-7 shrink-0 items-center gap-3 border-b border-border-subtle px-4">
      <span
        v-for="column in columns"
        :key="column.id"
        class="relative items-center"
        :class="[columnDisplay(column), column.className]"
      >
        <WaterfallAxis v-if="column.id === 'waterfall'" :range="props.range" />
        <SortHeader
          :label="column.label"
          :state="sortState(column)"
          :align="column.align"
          class="w-full"
          @toggle="toggleSort(column)"
        />
      </span>
    </div>
    <div
      ref="scroller"
      class="min-h-0 flex-1 overflow-y-auto py-1 outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
      tabindex="0"
      role="listbox"
      aria-label="Requests"
      :aria-activedescendant="activeId"
      @keydown="onKeydown"
      @scroll.passive="onScroll"
      @contextmenu="onListContextMenu"
    >
      <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
      <div
        v-for="row in rows"
        :id="row.id"
        :key="row.entry.requestId"
        role="option"
        :aria-selected="row.selected"
        class="mx-1.5 flex cursor-default items-center gap-3 rounded-control px-2.5"
        :class="rowStateClass(row.selected)"
        :style="{ height: `${REQUEST_ROW_HEIGHT}px` }"
        @click="onClick($event, row.entry)"
        @contextmenu="emit('menu', row.entry)"
      >
        <span
          v-for="column in columns"
          :key="column.id"
          class="min-w-0 items-center"
          :class="[columnDisplay(column), column.className]"
        >
          <RequestNameCell v-if="column.id === 'name'" :cells="row.cells" />
          <template v-else-if="column.id === 'waterfall'">
            <RequestWaterfall v-if="row.bar" :bar="row.bar" :failed="row.failed" />
          </template>
          <span
            v-else
            class="truncate"
            :class="row.cells[column.id].className"
            :title="row.cells[column.id].title"
          >
            {{ row.cells[column.id].text }}
          </span>
        </span>
      </div>
      <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
    </div>
  </div>
</template>
