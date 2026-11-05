<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { getCoreRowModel, useVueTable, type ColumnDef } from "@tanstack/vue-table";
import SortHeader from "@/shared/components/presentation/SortHeader.vue";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import { scrollTopToReveal } from "@/shared/list/grid";
import { optionId, rowStateClass } from "@/shared/list/rowState";
import type { NetworkEntry } from "@/types/network.types";
import RequestWaterfall from "./RequestWaterfall.vue";
import {
  TONE_CLASS,
  initiatorWord,
  requestName,
  sizeCell,
  statusCell,
  timeCell,
  typeWord,
} from "./requestCells";
import {
  REQUEST_COLUMNS,
  REQUEST_ROW_HEIGHT,
  columnDisplay,
  type RequestColumn,
  type RequestColumnId,
} from "./requestColumns";
import { nextSort, type RequestSort } from "./requestSort";
import { waterfallBar, type WaterfallBar, type WaterfallRange } from "./waterfall";

const props = defineProps<{
  entries: readonly NetworkEntry[];
  selectedId: string | null;
  range: WaterfallRange | null;
}>();

const sort = defineModel<RequestSort | null>("sort", { required: true });

const emit = defineEmits<{
  select: [entry: NetworkEntry];
  clear: [];
  menu: [entry: NetworkEntry];
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
  getCoreRowModel: getCoreRowModel(),
});
const columns = computed(() =>
  table.getVisibleLeafColumns().map((column) => column.columnDef.meta as RequestColumn),
);

const scroller = ref<HTMLElement | null>(null);
const source = computed(() => props.entries);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(source, scroller, {
  itemHeight: REQUEST_ROW_HEIGHT,
  overscan: 12,
});

const CELL_CLASS: Record<RequestColumnId, string> = {
  method: "font-mono text-2xs text-muted-foreground",
  name: "font-mono text-xs text-foreground",
  status: "font-mono text-xs tabular-nums",
  type: "text-xs text-muted-foreground",
  initiator: "font-mono text-2xs text-[var(--fg-subtle)]",
  size: "font-mono text-2xs tabular-nums",
  time: "font-mono text-2xs tabular-nums",
  waterfall: "",
};

const EMPTY_BAR: WaterfallBar = { left: 0, waiting: 0, receiving: 0, open: false };

interface RowCell {
  text: string;
  tone: string;
  title: string | undefined;
}

function cellsOf(entry: NetworkEntry): Record<Exclude<RequestColumnId, "waterfall">, RowCell> {
  const status = statusCell(entry);
  const size = sizeCell(entry);
  const time = timeCell(entry);
  return {
    method: { text: entry.method, tone: "", title: undefined },
    name: { text: requestName(entry.url), tone: "", title: entry.url },
    status: {
      text: status.text,
      tone: TONE_CLASS[status.tone],
      title: entry.errorText || entry.statusText || undefined,
    },
    type: { text: typeWord(entry), tone: "", title: entry.mimeType || undefined },
    initiator: { text: initiatorWord(entry), tone: "", title: entry.initiatorUrl },
    size: { text: size.text, tone: TONE_CLASS[size.tone], title: undefined },
    time: { text: time.text, tone: TONE_CLASS[time.tone], title: undefined },
  };
}

const rows = computed(() =>
  items.value.map(({ data: entry }) => ({
    entry,
    id: optionId(listId, entry.requestId),
    cells: cellsOf(entry),
    bar: props.range ? waterfallBar(entry, props.range) : null,
    failed: entry.state === "failed",
    selected: entry.requestId === props.selectedId,
  })),
);

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
  if (!element) return;
  element.scrollTop = scrollTopToReveal(
    index,
    REQUEST_ROW_HEIGHT,
    element.scrollTop,
    element.clientHeight,
  );
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

/** Keeps the newest request in view while the list sits at its end, nothing is selected and no sort is set. */
const FOLLOW_SLACK = REQUEST_ROW_HEIGHT * 2;
let following = true;

function onScroll() {
  const element = scroller.value;
  if (!element) return;
  following = element.scrollHeight - element.scrollTop - element.clientHeight <= FOLLOW_SLACK;
}

watch(
  () => props.entries.length,
  (length, previous) => {
    const element = scroller.value;
    if (!element || sort.value || props.selectedId || !following || length <= (previous ?? 0))
      return;
    element.scrollTop = element.scrollHeight;
  },
  { flush: "post" },
);

defineExpose({ move, focus: () => scroller.value?.focus() });
</script>

<template>
  <div class="@container flex h-full min-h-0 flex-col">
    <div class="flex h-7 shrink-0 items-center gap-3 border-b border-border-subtle px-4">
      <span
        v-for="column in columns"
        :key="column.id"
        class="items-center"
        :class="[columnDisplay(column), column.className]"
      >
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
          <RequestWaterfall
            v-if="column.id === 'waterfall'"
            v-show="row.bar"
            :bar="row.bar ?? EMPTY_BAR"
            :failed="row.failed"
          />
          <span
            v-else
            class="truncate"
            :class="[CELL_CLASS[column.id], row.cells[column.id].tone]"
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
