<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { refDebounced } from "@vueuse/core";
import { toast } from "vue-sonner";
import { Lock, PanelRight, Trash2 } from "lucide-vue-next";
import { Button, SearchField } from "@capubridge/cladd";
import { CACHE_BODY_PREVIEW_BYTES, CacheStorageGoneError } from "@capubridge/cdp-protocol";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  DataGrid,
  DataGridStatus,
  type GridContextAction,
  type GridContextTarget,
  type GridSort,
  type GridSummary,
} from "@/shared/components/data/grid";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { readsBodyAtOnce } from "./cacheBody";
import { CACHE_COLUMNS, gridRowOf, shownRows } from "./cacheGrid";
import type { CacheRow } from "./cacheModel";
import CacheEntryPane from "./CacheEntryPane.vue";
import { errorText, useCacheEntry } from "./useCacheQueries";
import { useCachePane } from "./useCachePane";
import type { useCacheWrites } from "./useCacheWrites";

const PANE_SETTLE_MS = 140;

/**
 * Find, the entries of one cache in the grid, the entry pane beside it and the status bar.
 * Every delete asks first and names the entries; the pane follows a row by id.
 */
const props = defineProps<{
  targetId: string;
  origin: string;
  cacheName: string;
  rows: readonly CacheRow[];
  loading: boolean;
  total: number | null;
  /** Entries whose response was read before the read's time ran out. */
  described: number | null;
  /** The phone cannot answer now. */
  paused: boolean;
  writes: ReturnType<typeof useCacheWrites>;
}>();

const emit = defineEmits<{ readList: [] }>();

const find = ref("");
const findText = refDebounced(find, 150);
const searchBox = ref<HTMLElement | null>(null);
const grid = ref<InstanceType<typeof DataGrid> | null>(null);
const sort = ref<GridSort | null>(null);
const summary = shallowRef<GridSummary>({
  rowCount: 0,
  selectedRows: 0,
  selectedRowIds: [],
  selectedCells: 0,
  aggregate: null,
});

const shown = computed(() => shownRows(props.rows, findText.value, sort.value));
const columns = computed(() =>
  props.rows.some((row) => row.servedAt !== null)
    ? CACHE_COLUMNS
    : CACHE_COLUMNS.filter((column) => column.id !== "served"),
);
const gridRows = computed(() => shown.value.map((row) => gridRowOf(row)));
const order = computed(() => shown.value.map((row) => row.id));
const byId = computed(() => new Map(props.rows.map((row) => [row.id, row])));
const narrowed = computed(() => findText.value.trim() !== "");
const read = computed(() => props.rows.length);
const unread = computed(() =>
  props.described === null ? 0 : Math.max(0, read.value - props.described),
);

const pane = useCachePane({ rows: computed(() => props.rows), order, grid });
const shownId = computed(() => (pane.visible.value ? (pane.row.value?.id ?? null) : null));
const settledId = refDebounced(shownId, PANE_SETTLE_MS);
const bodyAskedFor = ref<string | null>(null);
const bodyBytes = computed(() => {
  const row = pane.row.value;
  if (!row || row.opaque) return 0;
  if (readsBodyAtOnce(row.mediaType) || bodyAskedFor.value === row.id) {
    return CACHE_BODY_PREVIEW_BYTES;
  }
  return 0;
});
const entry = useCacheEntry(
  computed(() => props.targetId),
  computed(() => props.origin),
  computed(() => props.cacheName),
  settledId,
  bodyBytes,
  computed(() => props.paused),
);
const entryGone = computed(() => entry.error.value instanceof CacheStorageGoneError);
const entryError = computed(() => (entryGone.value ? null : errorText(entry.error.value)));
const detail = computed(() =>
  entry.detail.value && entry.detail.value.id === pane.row.value?.id
    ? entry.detail.value
    : undefined,
);
const panePosition = computed(() => {
  if (pane.index.value < 0) return narrowed.value ? "Not in the rows shown" : null;
  return `${pane.index.value + 1} of ${shown.value.length}`;
});

function requestDelete(ids: readonly string[]) {
  const list = ids
    .map((id) => byId.value.get(id))
    .filter((row): row is CacheRow => row !== undefined);
  void props.writes.confirmAndRemove(list).then((removed) => {
    if (removed > 0) grid.value?.clearSelection();
  });
}

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied the ${what}`);
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}

function contextActions(target: GridContextTarget): GridContextAction[] {
  const row = target.rowId ? byId.value.get(target.rowId) : undefined;
  if (!row) return [];
  const actions: GridContextAction[] = [
    { id: "open", label: "Show in the pane", binding: "space", separatorBefore: true },
    { id: "copy-url", label: "Copy the address", separatorBefore: true },
  ];
  if (props.writes.blockedReason.value === null) {
    const count = target.rowIds.length;
    actions.push({
      id: "delete",
      label: count > 1 ? `Delete ${count} entries…` : "Delete the entry…",
      binding: "delete",
      danger: true,
      separatorBefore: true,
    });
  }
  return actions;
}

function runContextAction(actionId: string, target: GridContextTarget) {
  const row = target.rowId ? byId.value.get(target.rowId) : undefined;
  if (!row) return;
  if (actionId === "open") pane.show(row.id);
  else if (actionId === "copy-url") void copyText(row.url, "address");
  else if (actionId === "delete") requestDelete(target.rowIds);
}

function onPaneKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  event.stopPropagation();
  pane.close();
}

function focusFind() {
  const input = searchBox.value?.querySelector("input");
  input?.focus();
  input?.select();
}

defineExpose({ focusFind });
</script>

<template>
  <div class="flex shrink-0 items-center gap-1.5 px-3 py-2">
    <span ref="searchBox" class="contents">
      <SearchField
        v-model="find"
        size="sm"
        class="w-60 min-w-36 shrink"
        placeholder="Find an address, status or type"
        aria-label="Find an address, status or type"
      />
    </span>
    <span class="flex-1" />
    <IconAction
      v-if="writes.blockedReason.value === null && summary.selectedRows > 1"
      :label="`Delete ${summary.selectedRows} selected`"
      hint="Asks first"
      @click="requestDelete(summary.selectedRowIds)"
    >
      <Trash2 :stroke-width="1.8" />
    </IconAction>
  </div>

  <ResizablePanelGroup
    direction="horizontal"
    auto-save-id="capubridge:data-record-pane-size:v2"
    class="min-h-0 flex-1"
  >
    <ResizablePanel id="cache-rows-grid" :order="1" :min-size="35" class="min-h-0">
      <div class="h-full min-h-0 px-2 pb-2">
        <DataGrid
          ref="grid"
          :label="`Cache ${cacheName}`"
          :columns="columns"
          :rows="gridRows"
          :loading="loading"
          :read-only="writes.blockedReason.value !== null"
          :sort="sort"
          activate-rows
          :column-features="{ filter: false, group: false, showAs: false }"
          :context-actions="contextActions"
          layout-key="cache-storage"
          @update:sort="sort = $event"
          @active-row="$event && pane.follow($event)"
          @activate="pane.show"
          @inspect="pane.show"
          @delete="requestDelete"
          @summary="summary = $event"
          @context-action="runContextAction"
        >
          <template #empty>
            <div v-if="narrowed" class="flex flex-col items-start gap-2">
              <span>No entry matches “{{ findText.trim() }}”.</span>
              <Button size="sm" variant="transparent" @click="find = ''">Clear find</Button>
            </div>
            <span v-else>The cache “{{ cacheName }}” is empty.</span>
          </template>
        </DataGrid>
      </div>
    </ResizablePanel>
    <template v-if="pane.visible.value && pane.row.value">
      <ResizableHandle
        class="w-2 bg-transparent before:absolute before:inset-y-4 before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:transition-colors hover:bg-transparent hover:before:bg-border data-[state=drag]:before:bg-ring"
      />
      <ResizablePanel
        id="cache-rows-pane"
        :order="2"
        size-unit="px"
        :default-size="420"
        :min-size="280"
        :max-size="560"
        class="min-h-0"
      >
        <div class="h-full min-h-0 pr-2 pb-2" @keydown="onPaneKeydown">
          <div
            class="h-full min-h-0 overflow-hidden rounded-cladd-md border border-cladd-outline bg-cladd-bg"
          >
            <CacheEntryPane
              :key="`${cacheName}::${pane.row.value.id}`"
              :row="pane.row.value"
              :detail="detail"
              :loading="entry.loading.value || settledId !== shownId"
              :error="entryError"
              :gone="entryGone"
              :position="panePosition"
              :blocked-reason="writes.blockedReason.value"
              :busy="writes.busy.value"
              :can-prev="pane.canPrev.value"
              :can-next="pane.canNext.value"
              @delete="pane.row.value && requestDelete([pane.row.value.id])"
              @prev="pane.step(-1)"
              @next="pane.step(1)"
              @close="pane.close()"
              @retry="entry.refetch()"
              @read-body="bodyAskedFor = pane.row.value?.id ?? null"
              @read-list="emit('readList')"
            />
          </div>
        </div>
      </ResizablePanel>
    </template>
  </ResizablePanelGroup>

  <DataGridStatus :summary="summary" :total="narrowed ? rows.length : null">
    <span v-if="total !== null && total > read" class="truncate text-[var(--fg-subtle)]">
      First {{ read.toLocaleString("en-US") }} of {{ total.toLocaleString("en-US") }} entries read
    </span>
    <span v-if="unread > 0" class="truncate text-[var(--fg-subtle)]">
      {{ unread.toLocaleString("en-US") }} without status or size (the read ran out of time)
    </span>
    <HintTooltip v-if="writes.blockedReason.value" :text="writes.blockedReason.value">
      <span class="flex items-center gap-1" tabindex="0">
        <Lock :size="11" aria-hidden="true" />
        deletes wait
      </span>
    </HintTooltip>
    <IconAction
      :label="pane.open.value ? 'Hide the pane' : 'Show the pane'"
      size="sm"
      toggle
      :pressed="pane.open.value"
      @click="pane.open.value = !pane.open.value"
    >
      <PanelRight :stroke-width="1.8" />
    </IconAction>
  </DataGridStatus>
</template>
