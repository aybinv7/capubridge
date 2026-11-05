<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { Lock, PanelRight } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { toast } from "vue-sonner";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  cellToText,
  DataGrid,
  DataGridStatus,
  type GridColumnMenuAction,
  type GridColumnType,
  type GridContextAction,
  type GridContextTarget,
  type GridEditingCell,
  type GridSort,
  type GridSummary,
} from "@/shared/components/data/grid";
import CellEditor from "@/shared/components/data/grid/editors/CellEditor.vue";
import { editorKindFor } from "@/shared/components/data/grid/editors/cellEdit";
import type { DataPredicate, PredicateJoin } from "@/shared/components/data/filter/predicates";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { readPersisted, writePersisted } from "@/lib/persisted";
import type { StoreInfo } from "@capubridge/cdp-protocol";
import DataPager from "@/modules/storage/frame/DataPager.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import RecordPane from "@/modules/storage/frame/RecordPane.vue";
import { formatAge } from "@/modules/storage/frame/changeWords";
import type { IndexedDBDecoratedRecord } from "@/modules/storage/changes/useIndexedDBChangeOverlay";
import IdbRowsToolbar from "./IdbRowsToolbar.vue";
import { buildIdbGrid, keyLabelOf, KEY_COLUMN } from "./idbGridModel";
import { GROUP_COUNT_COLUMN, GROUP_ROW_PREFIX, groupRows, pipeRows } from "./idbRowPipeline";
import { formatBytes } from "@/shared/format/numbers";
import { exportRows } from "./idbRowsExport";
import { useIdbRecordPane } from "./useIdbRecordPane";
import type { useIdbPage } from "./useIdbPage";
import type { useIdbStoreWrites } from "./useIdbStoreWrites";

const SHOW_AS_KEY = "capubridge:data-show-as:v1";

const props = defineProps<{
  database: string;
  store: string;
  storeInfo: StoreInfo | undefined;
  records: readonly IndexedDBDecoratedRecord[];
  pager: ReturnType<typeof useIdbPage>;
  writes: ReturnType<typeof useIdbStoreWrites>;
  changesOnly: boolean;
  layoutKey: string;
}>();

const emit = defineEmits<{
  deleteRecords: [records: IndexedDBDecoratedRecord[], afterDelete: () => void];
}>();

const toolbar = ref<InstanceType<typeof IdbRowsToolbar> | null>(null);
const grid = ref<InstanceType<typeof DataGrid> | null>(null);
const search = ref("");
const predicates = ref<DataPredicate[]>([]);
const join = ref<PredicateJoin>("and");
const sort = ref<GridSort | null>(null);
const visibility = ref<Record<string, boolean>>({});
const filterOpen = ref(false);
const filterSeed = ref<string | null>(null);
const groupBy = ref<string | null>(null);
const editing = ref<GridEditingCell | null>(null);
const summary = shallowRef<GridSummary>({
  rowCount: 0,
  selectedRows: 0,
  selectedRowIds: [],
  selectedCells: 0,
  aggregate: null,
});

const showAsAll = ref(
  readPersisted<Record<string, Record<string, GridColumnType>>>(
    SHOW_AS_KEY,
    {},
    (value) => typeof value === "object" && value !== null && !Array.isArray(value),
  ),
);
const showAs = computed(() => showAsAll.value[props.layoutKey] ?? {});

const indexPaths = computed(
  () =>
    new Set(
      (props.storeInfo?.indexes ?? []).flatMap((index) =>
        Array.isArray(index.keyPath) ? index.keyPath : [index.keyPath],
      ),
    ),
);
const model = computed(() =>
  buildIdbGrid(props.records, props.storeInfo?.keyPath ?? null, indexPaths.value),
);
const shown = computed(() =>
  pipeRows({
    rows: model.value.rows,
    columns: model.value.columns,
    search: search.value,
    predicates: predicates.value,
    join: join.value,
    sort: sort.value,
    changesOnly: props.changesOnly,
    states: model.value.states,
  }),
);

const groupColumn = computed(() =>
  groupBy.value ? model.value.columns.find((column) => column.id === groupBy.value) : undefined,
);
const gridColumns = computed(() =>
  groupColumn.value
    ? [
        { ...groupColumn.value, readOnly: true },
        { id: GROUP_COUNT_COLUMN, title: "rows", type: "integer" as const },
      ]
    : model.value.columns,
);
const gridRows = computed(() =>
  groupBy.value ? groupRows(shown.value, groupBy.value) : shown.value,
);

function openGroup(rowId: string) {
  const column = groupBy.value;
  const row = gridRows.value.find((entry) => entry.id === rowId);
  if (!column || !row || !rowId.startsWith(GROUP_ROW_PREFIX)) return;
  const value = row.cells[column];
  predicates.value = [
    ...predicates.value,
    value === null || value === undefined
      ? { id: `g${Date.now()}`, columnId: column, operator: "isNull", value: "" }
      : { id: `g${Date.now()}`, columnId: column, operator: "equals", value: cellToText(value) },
  ];
  groupBy.value = null;
}

const inStoreSearch = computed(() => props.pager.storeSearch.value !== null);
const pane = useIdbRecordPane({
  rows: shown,
  grid,
  page: props.pager.page,
  hasMore: props.pager.hasMore,
  pagingEnabled: computed(() => !inStoreSearch.value),
  setPage: props.pager.setPage,
});

watch(
  () => props.layoutKey,
  () => {
    search.value = "";
    predicates.value = [];
    sort.value = null;
    visibility.value = {};
    groupBy.value = null;
    editing.value = null;
    pane.activeRowId.value = null;
  },
);

const paneRecord = computed(() =>
  pane.rowId.value ? (model.value.byId.get(pane.rowId.value) ?? null) : null,
);
const paneSize = computed(() => {
  const value = paneRecord.value?.value;
  try {
    return new TextEncoder().encode(JSON.stringify(value) ?? "").length;
  } catch {
    return 0;
  }
});
const paneSubtitle = computed(() => {
  const position =
    pane.index.value >= 0
      ? `${pane.index.value + 1} of ${shown.value.length}`
      : "Not in the rows shown";
  return `${position} · ${formatBytes(paneSize.value)}`;
});
const paneRow = computed(() => model.value.rows.find((row) => row.id === pane.rowId.value) ?? null);

const pageLocal = computed(
  () =>
    !inStoreSearch.value &&
    (search.value.trim() !== "" || predicates.value.length > 0 || sort.value !== null),
);
const scopeNote = computed(() => {
  const found = props.pager.storeSearch.value;
  if (found) {
    if (found.running) return `Searching the whole store for “${found.needle}”…`;
    if (found.error) return `The search failed: ${found.error}`;
    const capped =
      found.capped === "time"
        ? ", stopped after 4 s"
        : found.capped === "count"
          ? ", stopped after 50,000 records"
          : found.capped === "limit"
            ? ", first 500 matches"
            : "";
    return `${found.records.length.toLocaleString("en-US")} found in the whole store · ${found.scanned.toLocaleString("en-US")} records searched${capped}`;
  }
  if (pageLocal.value) {
    return `Find, filters and sort cover the ${model.value.rows.length.toLocaleString("en-US")} rows on this page`;
  }
  return null;
});

function setShowAs(columnId: string, type: GridColumnType | null) {
  const current = { ...showAs.value };
  if (type) current[columnId] = type;
  else delete current[columnId];
  showAsAll.value = { ...showAsAll.value, [props.layoutKey]: current };
  writePersisted(SHOW_AS_KEY, showAsAll.value);
}

function onColumnAction(columnId: string, action: GridColumnMenuAction) {
  if (action.kind === "filter") {
    filterSeed.value = columnId;
    filterOpen.value = true;
  } else if (action.kind === "showAs") setShowAs(columnId, action.type);
  else if (action.kind === "hide") visibility.value = { ...visibility.value, [columnId]: false };
}

watch(filterOpen, (isOpen) => {
  if (!isOpen) filterSeed.value = null;
});

function readOnlyCell(rowId: string, columnId: string): string | null {
  const record = model.value.byId.get(rowId);
  if (!record) return "This row is gone.";
  return props.writes.cellReadOnlyReason(record, columnId, showAs.value[columnId]);
}

function startEdit(rowId: string, columnId: string) {
  if (readOnlyCell(rowId, columnId) !== null) {
    pane.show(rowId);
    return;
  }
  editing.value = { rowId, columnId };
}

async function commitEdit(value: unknown) {
  const target = editing.value;
  editing.value = null;
  grid.value?.focus();
  const record = target ? model.value.byId.get(target.rowId) : undefined;
  if (target && record) await props.writes.saveCell(record, target.columnId, value);
}

function cancelEdit() {
  editing.value = null;
  grid.value?.focus();
}

function deletable(ids: readonly string[]): IndexedDBDecoratedRecord[] {
  return ids
    .map((id) => model.value.byId.get(id))
    .filter((record): record is IndexedDBDecoratedRecord =>
      Boolean(record && !record.__changeDeleted),
    );
}

function requestDelete(ids: readonly string[]) {
  if (!props.writes.canWrite.value) return;
  const records = deletable(ids);
  if (records.length) emit("deleteRecords", records, () => grid.value?.clearSelection());
}

function contextActions(target: GridContextTarget): GridContextAction[] {
  if (groupBy.value) {
    return [
      { id: "open-group", label: "Show the rows in this group", separatorBefore: true },
      { id: "ungroup", label: "Stop grouping" },
    ];
  }
  const actions: GridContextAction[] = [];
  if (target.rowId)
    actions.push({
      id: "open",
      label: "Show in the record pane",
      binding: "space",
      separatorBefore: true,
    });
  if (target.rowId && target.columnId && readOnlyCell(target.rowId, target.columnId) === null) {
    const column = model.value.columns.find((entry) => entry.id === target.columnId);
    actions.push({
      id: "edit",
      label: `Edit “${column?.title ?? target.columnId}”`,
      binding: "enter",
    });
  }
  if (target.rowId) actions.push({ id: "copy-record", label: "Copy the record as JSON" });
  if (props.writes.canWrite.value && deletable(target.rowIds).length) {
    const count = deletable(target.rowIds).length;
    actions.push({
      id: "delete",
      label: count > 1 ? `Delete ${count} records…` : "Delete the record…",
      binding: "delete",
      danger: true,
      separatorBefore: true,
    });
  }
  return actions;
}

async function copyRecord(rowId: string) {
  const record = model.value.byId.get(rowId);
  if (!record) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(record.value, null, 2));
    toast.success("Copied the record");
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}

function runContextAction(actionId: string, target: GridContextTarget) {
  if (actionId === "open-group" && target.rowId) openGroup(target.rowId);
  else if (actionId === "ungroup") groupBy.value = null;
  else if (actionId === "open" && target.rowId) pane.show(target.rowId);
  else if (actionId === "edit" && target.rowId && target.columnId)
    startEdit(target.rowId, target.columnId);
  else if (actionId === "copy-record" && target.rowId) void copyRecord(target.rowId);
  else if (actionId === "delete") requestDelete(target.rowIds);
}

function onExport(actionId: string) {
  const selected = new Set(summary.value.selectedRowIds);
  const rows =
    actionId === "selected" ? shown.value.filter((row) => selected.has(row.id)) : shown.value;
  const visibleColumns = model.value.columns.filter(
    (column) => visibility.value[column.id] !== false,
  );
  void exportRows({
    format: actionId === "csv" ? "csv" : "json",
    database: props.database,
    store: props.store,
    suffix:
      actionId === "selected"
        ? "selected"
        : inStoreSearch.value
          ? "search"
          : `page${props.pager.page.value + 1}`,
    columns: visibleColumns,
    rows,
    records: rows
      .map((row) => model.value.byId.get(row.id))
      .filter((record) => record !== undefined),
  });
}

function onFilter(next: DataPredicate[], nextJoin: PredicateJoin) {
  predicates.value = next;
  join.value = nextJoin;
}

const paneState = computed(() => {
  const record = paneRecord.value;
  const change = record?.__recordChange;
  if (!change) return null;
  const who = change.source === "capubridge" ? "by Capubridge" : "on the device";
  const what =
    change.operation === "add" ? "Added" : change.operation === "delete" ? "Deleted" : "Changed";
  return `${what} ${who} ${formatAge(Date.now() - Date.parse(change.observedAt))}`;
});
const paneBefore = computed(() => {
  const change = paneRecord.value?.__recordChange;
  return change && change.operation !== "add" ? { value: change.beforeValue } : null;
});
const paneReadOnly = computed(() => {
  const record = paneRecord.value;
  if (!record) return null;
  if (!props.writes.canWrite.value) return "Opened from a file: it is read-only here.";
  return record.editable === false
    ? (record.readOnlyReason ?? "This record cannot be saved here.")
    : null;
});

async function savePane(value: unknown) {
  const record = paneRecord.value;
  if (record && (await props.writes.saveRecord(record, value))) pane.setDirty(false);
}

defineExpose({ focusSearch: () => toolbar.value?.focusSearch() });
</script>

<template>
  <IdbRowsToolbar
    ref="toolbar"
    v-model:search="search"
    v-model:visibility="visibility"
    v-model:filter-open="filterOpen"
    :columns="model.columns"
    :predicates="predicates"
    :join="join"
    :filter-seed="filterSeed"
    :selected-count="summary.selectedRows"
    :can-delete="writes.canWrite.value"
    :store-searching="pager.storeSearch.value?.running ?? false"
    :in-store-search="inStoreSearch"
    @search-store="pager.searchWholeStore(search)"
    @filter="onFilter"
    @export="onExport"
    @delete-selected="requestDelete(summary.selectedRowIds)"
  />

  <DataState
    v-if="pager.error.value && records.length === 0"
    kind="error"
    title="Could not read the records"
    :detail="pager.error.value"
    @retry="pager.refetch()"
  />
  <ResizablePanelGroup
    v-else
    direction="horizontal"
    auto-save-id="capubridge:data-record-pane-size"
    class="min-h-0 flex-1"
  >
    <ResizablePanel id="idb-rows-grid" :order="1" :min-size="35" class="min-h-0">
      <div class="h-full min-h-0 px-2 pb-2">
        <DataGrid
          ref="grid"
          :label="store"
          :columns="gridColumns"
          :rows="gridRows"
          :loading="pager.loading.value"
          :read-only="!writes.canWrite.value || groupBy !== null"
          :row-states="model.states"
          :sort="sort"
          :row-number-offset="inStoreSearch ? 0 : pager.page.value * pager.pageSize.value"
          :column-visibility="visibility"
          :show-as="showAs"
          :column-features="{ filter: !groupBy, group: true, showAs: true }"
          :grouped-column="groupBy"
          :activate-rows="groupBy !== null"
          @activate="openGroup"
          :context-actions="contextActions"
          :editing="editing"
          :layout-key="layoutKey"
          @update:sort="sort = $event"
          @column-action="onColumnAction"
          @active-row="$event && !groupBy && (pane.activeRowId.value = $event)"
          @inspect="pane.show"
          @edit="startEdit"
          @delete="requestDelete"
          @summary="summary = $event"
          @context-action="runContextAction"
        >
          <template #editor="{ rowId, column, value }">
            <CellEditor
              :key="`${rowId}:${column.id}`"
              :value="value"
              :kind="editorKindFor(value, showAs[column.id]) ?? 'text'"
              :label="`Edit ${column.title}`"
              @commit="commitEdit"
              @cancel="cancelEdit"
            />
          </template>
          <template #empty>
            <div
              v-if="search || predicates.length || changesOnly"
              class="flex flex-col items-start gap-2"
            >
              <span>No row on this page matches.</span>
              <Button
                size="sm"
                variant="transparent"
                @click="
                  search = '';
                  predicates = [];
                "
              >
                Clear find and filters
              </Button>
            </div>
            <span v-else-if="inStoreSearch">Nothing in “{{ store }}” matches.</span>
            <span v-else-if="pager.page.value > 0">No records on this page.</span>
            <span v-else>“{{ store }}” has no records.</span>
          </template>
        </DataGrid>
      </div>
    </ResizablePanel>
    <template v-if="pane.visible.value && paneRecord && paneRow && !groupBy">
      <ResizableHandle
        class="w-2 bg-transparent before:absolute before:inset-y-4 before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:transition-colors hover:bg-transparent hover:before:bg-border data-[state=drag]:before:bg-ring"
      />
      <ResizablePanel
        id="idb-rows-pane"
        :order="2"
        :default-size="34"
        :min-size="22"
        :max-size="60"
        class="min-h-0"
      >
        <div class="h-full min-h-0 pr-2 pb-2" @keydown.esc.stop="pane.close()">
          <div
            class="h-full min-h-0 overflow-hidden rounded-cladd-md border border-cladd-outline bg-cladd-bg"
          >
            <RecordPane
              :key="paneRow.id"
              :title="keyLabelOf(paneRecord)"
              :subtitle="paneSubtitle"
              :state-text="paneState"
              :columns="
                model.columns.filter((column) => column.id !== KEY_COLUMN || !model.keyField)
              "
              :cells="paneRow.cells"
              :value="paneRecord.value"
              :read-only-reason="paneReadOnly"
              :can-delete="writes.canWrite.value && !paneRecord.__changeDeleted"
              :before="paneBefore"
              :can-prev="pane.canPrev.value"
              :can-next="pane.canNext.value"
              :saving="writes.saving.value"
              @save="savePane"
              @delete="requestDelete([paneRow.id])"
              @prev="pane.step(-1)"
              @next="pane.step(1)"
              @close="pane.close()"
              @dirty="pane.setDirty"
            />
          </div>
        </div>
      </ResizablePanel>
    </template>
  </ResizablePanelGroup>

  <DataGridStatus :summary="summary" :total="null">
    <span v-if="scopeNote" class="truncate text-[var(--fg-subtle)]">{{ scopeNote }}</span>
    <Button
      v-if="inStoreSearch"
      size="2xs"
      variant="transparent"
      :outline="false"
      @click="pager.clearStoreSearch()"
    >
      Back to pages
    </Button>
    <span v-if="!writes.canWrite.value" class="flex items-center gap-1">
      <Lock :size="11" aria-hidden="true" />
      read-only
    </span>
    <DataPager
      v-if="!inStoreSearch"
      :page="pager.page.value"
      :page-size="pager.pageSize.value"
      :has-more="pager.hasMore.value"
      :rows-on-page="pager.records.value.length"
      :total="storeInfo?.recordCount ?? null"
      @update:page="pager.setPage"
      @update:page-size="pager.setPageSize"
    />
    <IconAction
      :label="pane.open.value ? 'Hide the record pane' : 'Show the record pane'"
      keys="space"
      size="sm"
      toggle
      :pressed="pane.open.value"
      @click="pane.open.value = !pane.open.value"
    >
      <PanelRight :stroke-width="1.8" />
    </IconAction>
  </DataGridStatus>
</template>
