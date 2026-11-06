<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from "vue";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import { scrollTopToReveal } from "@/shared/list/grid";
import { optionId, rowStateClass } from "@/shared/list/rowState";
import type { NetworkEntry } from "@/types/network.types";
import ListHeader from "../columns/ListHeader.vue";
import TruncateStart from "../columns/TruncateStart.vue";
import type { ListColumnsLayout } from "../columns/useListColumns";
import PendingTime from "./PendingTime.vue";
import RequestWaterfall from "./RequestWaterfall.vue";
import WaterfallAxis from "./WaterfallAxis.vue";
import { REQUEST_COLUMNS, REQUEST_ROW_HEIGHT, type RequestColumnId } from "./requestColumns";
import { rowCells, type RowCell, type RowCells } from "./requestRowCells";
import { nextSort, type RequestSort } from "./requestSort";
import { waterfallBar, type WaterfallRange } from "./waterfall";

const props = defineProps<{
  entries: readonly NetworkEntry[];
  selectedId: string | null;
  range: WaterfallRange | null;
  /** The column layout, shared with the Columns menu. */
  layout: ListColumnsLayout<RequestColumnId>;
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
const header = ref<{ root: HTMLElement | null } | null>(null);
const headerElement = computed(() => header.value?.root ?? null);
const columns = computed(() => props.layout.shown.value);
const showWaterfall = computed(() => columns.value.some((column) => column.id === "waterfall"));
const SORT_KEYS = new Map(REQUEST_COLUMNS.map((column) => [column.id, column.sortKey] as const));

const scroller = ref<HTMLElement | null>(null);
const source = computed(() => props.entries);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(source, scroller, {
  itemHeight: REQUEST_ROW_HEIGHT,
  overscan: 12,
});

const rows = computed(() => {
  const range = showWaterfall.value ? props.range : null;
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

function sortState(id: RequestColumnId): "asc" | "desc" | false {
  const current = sort.value;
  if (!current || current.key !== SORT_KEYS.get(id)) return false;
  return current.desc ? "desc" : "asc";
}

function toggleSort(id: RequestColumnId) {
  const key = SORT_KEYS.get(id);
  if (key) sort.value = nextSort(sort.value, key);
}

/** The text cell of a column; the waterfall draws a bar instead. */
function cellOf(cells: RowCells, id: RequestColumnId): RowCell | null {
  return id === "waterfall" ? null : cells[id];
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

defineExpose({ move, focus: () => scroller.value?.focus(), header: headerElement });
</script>

<template>
  <div class="flex h-full min-h-0 flex-col" :style="{ '--list-cols': props.layout.template.value }">
    <ListHeader
      ref="header"
      :columns="columns"
      :edge-of="props.layout.edgeOf"
      :sort-of="sortState"
      :resizing="props.layout.resizing.value"
      @sort="toggleSort"
      @resize-start="props.layout.startResize"
      @reset-width="props.layout.resetWidth"
    >
      <template #extra="{ column }">
        <WaterfallAxis v-if="column.id === 'waterfall'" :range="props.range" />
      </template>
    </ListHeader>
    <div
      ref="scroller"
      class="min-h-0 flex-1 overflow-y-auto py-1 outline-none [scrollbar-gutter:stable] focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
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
        class="mx-1.5 grid cursor-default items-center rounded-control px-0.5 text-xs leading-4 whitespace-nowrap [grid-template-columns:var(--list-cols)]"
        :class="rowStateClass(row.selected)"
        :style="{ height: `${REQUEST_ROW_HEIGHT}px` }"
        @click="onClick($event, row.entry)"
        @contextmenu="emit('menu', row.entry)"
      >
        <span
          v-for="column in columns"
          :key="column.id"
          class="flex min-w-0 items-center px-2"
          :class="column.align === 'end' && 'justify-end'"
        >
          <PendingTime
            v-if="column.id === 'time' && row.cells.pendingSince !== null"
            :since="row.cells.pendingSince"
          />
          <template v-else-if="column.id === 'waterfall'">
            <RequestWaterfall v-if="row.bar" :bar="row.bar" :failed="row.failed" />
          </template>
          <TruncateStart
            v-else-if="column.id === 'path'"
            :text="row.cells.path.text"
            :class="row.cells.path.className"
            :title="row.cells.path.title"
          />
          <span
            v-else
            class="truncate"
            :class="cellOf(row.cells, column.id)?.className"
            :title="cellOf(row.cells, column.id)?.title"
          >
            {{ cellOf(row.cells, column.id)?.text }}
          </span>
        </span>
      </div>
      <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
    </div>
  </div>
</template>
