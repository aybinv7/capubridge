<script setup lang="ts">
import RecordSplit from "@/shared/components/layout/RecordSplit.vue";
import { computed, nextTick, ref, shallowRef, watch } from "vue";
import { refDebounced } from "@vueuse/core";
import { toast } from "@/lib/toast";
import { Lock, PanelRight, Trash2 } from "lucide-vue-next";
import { Button, SearchField } from "@capubridge/cladd";
import type { OPFSDomain } from "@capubridge/cdp-protocol";
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
import { useMinuteClock } from "@/shared/composables/useMinuteClock";
import { OPFS_COLUMNS, gridRowOf, shownRows } from "./opfsGrid";
import type { OpfsRow } from "./opfsModel";
import OpfsFilePane from "./OpfsFilePane.vue";
import { useOpfsPane } from "./useOpfsPane";
import { useOpfsPreview } from "./useOpfsPreview";
import type { useOpfsWrites } from "./useOpfsWrites";

/**
 * Find, the entries of one folder in the grid, the file pane beside it and the status bar. Every
 * delete asks first; the pane follows a row by path. Enter opens a folder, opens a SQLite file
 * in the SQLite tab, and shows any other file in the pane.
 */
const props = defineProps<{
  folderLabel: string;
  rows: readonly OpfsRow[];
  loading: boolean;
  /** Entries in the folder; more than the rows when the read stopped at its limit. */
  total: number | null;
  /** Why the phone cannot answer now, or `null`. */
  away: string | null;
  writes: ReturnType<typeof useOpfsWrites>;
  saving: string | null;
  bytes: () => OPFSDomain;
}>();

const emit = defineEmits<{
  openFolder: [path: string];
  openDatabase: [row: OpfsRow];
  download: [row: OpfsRow];
}>();

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
const clock = useMinuteClock();
const gridRows = computed(() => {
  const now = clock.value;
  return shown.value.map((row) => gridRowOf(row, now));
});
const order = computed(() => shown.value.map((row) => row.id));
const byId = computed(() => new Map(props.rows.map((row) => [row.id, row])));
const narrowed = computed(() => findText.value.trim() !== "");
const unread = computed(() =>
  props.total === null ? 0 : Math.max(0, props.total - props.rows.length),
);
const lockedCount = computed(() => props.rows.filter((row) => row.locked).length);

const pane = useOpfsPane({ rows: computed(() => props.rows), order, grid });

/** Opening a folder unmounts the grid that had focus: the new one takes it on its first rows. */
let takeFocus =
  typeof document !== "undefined" &&
  (document.activeElement === null || document.activeElement === document.body);
watch(
  () => order.value[0],
  (first) => {
    if (!first || !takeFocus) return;
    takeFocus = false;
    void nextTick(() => {
      grid.value?.focusRow(first);
      grid.value?.focus();
    });
  },
  { immediate: true },
);
const preview = useOpfsPreview({
  row: computed(() => (pane.visible.value ? pane.row.value : null)),
  paused: computed(() => props.away !== null),
  domain: props.bytes,
});
const panePosition = computed(() => {
  if (pane.index.value < 0) return narrowed.value ? "Not in the rows shown" : null;
  return `${pane.index.value + 1} of ${shown.value.length}`;
});

function rowsOf(ids: readonly string[]): OpfsRow[] {
  return ids.map((id) => byId.value.get(id)).filter((row): row is OpfsRow => row !== undefined);
}

function requestDelete(ids: readonly string[]) {
  void props.writes.confirmAndRemove(rowsOf(ids)).then((removed) => {
    if (removed > 0) grid.value?.clearSelection();
  });
}

function activate(id: string) {
  const row = byId.value.get(id);
  if (!row) return;
  if (row.kind === "directory") emit("openFolder", row.path);
  else if (row.role === "sqlite") emit("openDatabase", row);
  else pane.show(row.id);
}

async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(`/${path}`);
    toast.success("Copied the path");
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}

function contextActions(target: GridContextTarget): GridContextAction[] {
  const row = target.rowId ? byId.value.get(target.rowId) : undefined;
  if (!row) return [];
  const actions: GridContextAction[] = [];
  if (row.kind === "directory") actions.push({ id: "open", label: "Open the folder" });
  else {
    actions.push({ id: "show", label: "Show in the pane", binding: "space" });
    if (row.role === "sqlite" || row.role === "pool-slot") {
      actions.push({ id: "database", label: "Open in Data › SQLite" });
    }
    if (!row.locked && props.away === null) actions.push({ id: "download", label: "Download…" });
  }
  actions.push({ id: "copy-path", label: "Copy the path", separatorBefore: true });
  if (props.writes.blockedReason.value === null) {
    const count = target.rowIds.length;
    actions.push({
      id: "delete",
      label:
        count > 1
          ? `Delete ${count} items…`
          : row.kind === "directory"
            ? "Delete the folder…"
            : "Delete the file…",
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
  if (actionId === "open") emit("openFolder", row.path);
  else if (actionId === "show") pane.show(row.id);
  else if (actionId === "database") emit("openDatabase", row);
  else if (actionId === "download") emit("download", row);
  else if (actionId === "copy-path") void copyPath(row.path);
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
        placeholder="Find a name or kind"
        aria-label="Find a name or kind"
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

  <RecordSplit :pane-open="!!(pane.visible.value && pane.row.value)">
    <template #grid>
      <DataGrid
        ref="grid"
        frame="none"
        :label="`Folder ${folderLabel}`"
        :columns="OPFS_COLUMNS"
        :rows="gridRows"
        :loading="loading"
        :read-only="writes.blockedReason.value !== null"
        :sort="sort"
        activate-rows
        :column-features="{ filter: false, group: false, showAs: false }"
        :context-actions="contextActions"
        layout-key="opfs"
        @update:sort="sort = $event"
        @active-row="$event && pane.follow($event)"
        @pick="pane.show"
        @activate="activate"
        @inspect="pane.show"
        @delete="requestDelete"
        @summary="summary = $event"
        @context-action="runContextAction"
      >
        <template #empty>
          <div v-if="narrowed" class="flex flex-col items-start gap-2">
            <span>Nothing here is named “{{ findText.trim() }}”.</span>
            <Button size="sm" variant="transparent" @click="find = ''">Clear find</Button>
          </div>
          <span v-else>The folder “{{ folderLabel }}” is empty.</span>
        </template>
      </DataGrid>
    </template>
    <template #pane>
      <div
        v-if="pane.visible.value && pane.row.value"
        class="h-full min-h-0"
        @keydown="onPaneKeydown"
      >
        <OpfsFilePane
          :key="pane.row.value.id"
          :row="pane.row.value"
          :state="preview.state.value"
          :position="panePosition"
          :away="away"
          :blocked-reason="writes.blockedReason.value"
          :busy="writes.busy.value"
          :saving="saving === pane.row.value.path"
          :can-prev="pane.canPrev.value"
          :can-next="pane.canNext.value"
          @prev="pane.step(-1)"
          @next="pane.step(1)"
          @close="pane.close()"
          @delete="pane.row.value && requestDelete([pane.row.value.id])"
          @download="pane.row.value && emit('download', pane.row.value)"
          @retry="preview.retry()"
          @open-database="pane.row.value && emit('openDatabase', pane.row.value)"
          @open-folder="pane.row.value && emit('openFolder', pane.row.value.path)"
        />
      </div>
    </template>
  </RecordSplit>

  <DataGridStatus :summary="summary" :total="narrowed ? rows.length : null">
    <span v-if="unread > 0" class="truncate text-[var(--fg-subtle)]">
      First {{ rows.length.toLocaleString("en-US") }} of
      {{ (total ?? 0).toLocaleString("en-US") }} entries read
    </span>
    <span v-if="lockedCount > 0" class="truncate text-[var(--fg-subtle)]">
      {{ lockedCount.toLocaleString("en-US") }} in use by the app
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
