<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from "vue";
import { Lock, PanelRight } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { toast } from "@/lib/toast";
import {
  DataGrid,
  DataGridStatus,
  toCsv,
  type GridColumnMenuAction,
  type GridColumnType,
  type GridContextAction,
  type GridContextTarget,
  type GridRowState,
  type GridSort,
  type GridSummary,
} from "@/shared/components/data/grid";
import CellEditor from "@/shared/components/data/grid/editors/CellEditor.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import DataFreshness from "@/modules/storage/frame/DataFreshness.vue";
import DataPager from "@/modules/storage/frame/DataPager.vue";
import type { DataProvenance } from "@/modules/storage/frame/dataFrame.types";
import DataState from "@/modules/storage/frame/DataState.vue";
import RecordPane from "@/modules/storage/frame/RecordPane.vue";
import RecordSplit from "@/modules/storage/frame/RecordSplit.vue";
import { useRecordPane } from "@/modules/storage/frame/useRecordPane";
import { formatExactTime } from "@/shared/format/dates";
import { useSqliteUnsavedStore } from "@/modules/storage/stores/useSqliteUnsavedStore";
import { downloadText, fileStem } from "@/lib/download";
import { readPersisted, writePersisted } from "@/lib/persisted";
import type {
  SqliteColumnInfo,
  SqliteForeignKeyInfo,
  SqliteQueryResult,
} from "@/types/sqlite.types";
import type { SqliteRecordChange } from "@/types/sqliteChanges.types";
import { toSqliteInserts } from "../sqlText";
import { toGridColumns, toGridRows } from "./sqliteGrid";
import { recordKeyLabel, recordStateWords } from "./sqliteRecordTitle";
import {
  type PredicateOperator,
  type SqliteExportFormat,
  type SqliteExportScope,
} from "./sqliteQuery";
import type { SqliteGroupRows } from "./useSqliteGroupRows";
import type { SqliteTableQuery } from "./useSqliteTableQuery";
import SqliteBrowseToolbar from "./SqliteBrowseToolbar.vue";
import SqliteEditBar from "./SqliteEditBar.vue";
import SqliteGoToRow from "./SqliteGoToRow.vue";
import type { RowTarget } from "../quick/sqliteKeyInput";
import type { SqliteRowReveal } from "./useSqliteGoToRow";
import type { SqliteStaged } from "./sqliteChangeset";
import type { SqliteEditCommands } from "../useSqliteCommands";
import { useSqliteStagedEdits } from "./useSqliteStagedEdits";

const SHOW_AS_KEY = "capubridge:sqlite-show-as";

/** The rows of one table: filter bar, search, the grid with its record pane, and the pager. */
const props = defineProps<{
  tableName: string;
  /** The database's sidebar id (its path, or `file:<id>`), for its staged edits. */
  databaseId: string;
  /**
   * What per-table choices (show as, widths) are kept under: the database's path, or an opened
   * file's own path, so they survive opening the file again (P9).
   */
  stateKey: string;
  databaseName: string;
  result: SqliteQueryResult | null;
  hasMore: boolean;
  total: number | null;
  columnInfo: readonly SqliteColumnInfo[];
  foreignKeys: readonly SqliteForeignKeyInfo[];
  loading: boolean;
  error: string | null;
  filterError: string | null;
  changesByRowKey?: ReadonlyMap<string, SqliteRecordChange>;
  /** Why the table cannot be edited here; `null` when edits reach the source. */
  readOnlyReason: string | null;
  /** Show only rows the app changed while this table was watched. */
  changesOnly?: boolean;
  query: SqliteTableQuery;
  /** The grouped view as sections, used while the query groups by a column. */
  groups: SqliteGroupRows;
  /** Saves staged edits and new rows to the opened file; resolves whether it saved. */
  saveChanges: (staged: SqliteStaged) => Promise<boolean>;
  /** The file an opened file saves to, or `null` for a phone or page copy. */
  savesTo?: string | null;
  /** The opened file's working copy holds changes its file does not have yet. */
  unsaved?: boolean;
  /** Where the rows came from and when they were read, for the status bar. */
  provenance: DataProvenance;
  readAt: number | null;
  /** The change watcher keeps the copy current. */
  watched?: boolean;
  /** The rows on screen are an older page while the asked one is read. */
  stale?: boolean;
}>();

defineSlots<{ lead?: () => unknown; changes?: () => unknown; trail?: () => unknown }>();

const emit = defineEmits<{
  followForeignKey: [target: string, value: unknown];
  goToRow: [target: RowTarget];
  retry: [];
  fileAction: [action: "save-file" | "save-as"];
}>();

const grouped = computed(() => props.query.groupBy.value);
const offset = computed(() => props.query.page.value * props.query.pageSize.value);

const columnNames = computed(() => {
  if (!grouped.value) return props.result?.columns ?? [];
  return props.columnInfo.length > 0
    ? props.columnInfo.map((column) => column.name)
    : (props.groups.readColumns.value ?? []);
});
const columns = computed(() =>
  toGridColumns(columnNames.value, props.columnInfo, props.foreignKeys),
);

const mapped = computed(() => {
  if (grouped.value) return { rows: props.groups.dataRows.value, identified: true };
  return props.result
    ? toGridRows(props.result, props.columnInfo, offset.value)
    : { rows: [], identified: true };
});

const readOnly = computed(
  () => grouped.value !== null || props.readOnlyReason !== null || !mapped.value.identified,
);

const unsavedTables = useSqliteUnsavedStore();
const staging = useSqliteStagedEdits({
  rows: computed(() => mapped.value.rows),
  columns,
  showAs: computed(() => showAs.value),
  writable: computed(() => !readOnly.value),
  save: (staged) => props.saveChanges(staged),
  store: {
    read: () => unsavedTables.staged(props.databaseId, props.tableName),
    write: (next) => unsavedTables.setStaged(props.databaseId, props.tableName, next),
  },
});

const rowStates = computed(() => {
  const states = new Map<string, GridRowState>();
  if (props.changesByRowKey) {
    for (const row of mapped.value.rows) {
      if (props.changesByRowKey.has(row.id)) states.set(row.id, "recent");
    }
  }
  for (const [rowId, state] of staging.states.value) states.set(rowId, state);
  return states;
});

const shownRows = computed(() => (grouped.value ? props.groups.rows.value : staging.rows.value));
/** The rows that hold data, in display order: what the record pane steps through. */
const recordRows = computed(() => (grouped.value ? mapped.value.rows : staging.rows.value));

const visibleRows = computed(() =>
  props.changesOnly && !grouped.value
    ? shownRows.value.filter((row) => rowStates.value.has(row.id))
    : shownRows.value,
);
const lockReason = computed(() => {
  if (grouped.value) {
    return props.readOnlyReason ?? "Grouped rows are read-only. Stop grouping to edit them.";
  }
  return (
    props.readOnlyReason ??
    (mapped.value.identified
      ? null
      : "This table has no primary key, so a row cannot be told apart.")
  );
});

const visibility = computed({
  get: () => props.query.columnVisibility.value,
  set: (next: Record<string, boolean>) => (props.query.columnVisibility.value = next),
});

const showAsTable = computed(() => `${props.stateKey}/${props.tableName}`);
const showAsAll = ref(
  readPersisted<Record<string, Record<string, GridColumnType>>>(
    SHOW_AS_KEY,
    {},
    (value) => typeof value === "object" && value !== null && !Array.isArray(value),
  ),
);
const showAs = computed(() => showAsAll.value[showAsTable.value] ?? {});

function setShowAs(columnId: string, type: GridColumnType | null) {
  const current = { ...showAs.value };
  if (type) current[columnId] = type;
  else delete current[columnId];
  showAsAll.value = { ...showAsAll.value, [showAsTable.value]: current };
  writePersisted(SHOW_AS_KEY, showAsAll.value);
}

const toolbar = ref<InstanceType<typeof SqliteBrowseToolbar> | null>(null);

function onColumnAction(columnId: string, action: GridColumnMenuAction) {
  if (action.kind === "filter") toolbar.value?.openFilter(columnId);
  else if (action.kind === "group") {
    props.query.setGroupBy(grouped.value === columnId ? null : columnId);
  } else if (action.kind === "showAs") setShowAs(columnId, action.type);
  else if (action.kind === "hide") visibility.value = { ...visibility.value, [columnId]: false };
}

const FILTER_ACTIONS: Array<{ id: PredicateOperator; label: string }> = [
  { id: "=", label: "Filter: equals this value" },
  { id: "!=", label: "Filter: not this value" },
  { id: "null", label: "Filter: is NULL" },
  { id: "not-null", label: "Filter: is not NULL" },
];

/** Leaves grouping for the rows of one group, as a filter chip. */
function filterToGroup(rowId: string | null) {
  const group = props.groups.groupOf(rowId);
  if (!group) return;
  try {
    props.query.openGroup(group.value);
  } catch (error) {
    toast.error("Could not filter to this group", {
      description: error instanceof Error ? error.message : String(error),
    });
  }
}

function contextActions(target: GridContextTarget): GridContextAction[] {
  if (grouped.value && props.groups.groupOf(target.rowId)) {
    return [{ id: "open-group", label: "Filter to this group", separatorBefore: true }];
  }
  const actions: GridContextAction[] = [];
  if (target.columnId && target.rowId && !readOnly.value && !staging.isDeleting(target.rowId)) {
    if (staging.cellChanged(target.rowId, target.columnId)) {
      actions.push({ id: "undo-cell", label: "Undo this change" });
    }
    if (target.value !== null) actions.push({ id: "set-null", label: "Set to NULL" });
  }
  if (target.columnId) {
    FILTER_ACTIONS.forEach((action, index) =>
      actions.push({
        id: `filter:${action.id}`,
        label: action.label,
        separatorBefore: index === 0,
      }),
    );
  }
  const change = target.rowId ? props.changesByRowKey?.get(target.rowId) : undefined;
  if (change) {
    actions.push({
      id: "row-diff",
      label:
        change.source === "capubridge" ? "Show what changed here" : "Show what the app changed",
      separatorBefore: true,
    });
  }
  actions.push({
    id: "copy-insert",
    label:
      target.rowIds.length > 1
        ? `Copy ${target.rowIds.length} rows as INSERT`
        : "Copy row as INSERT",
    separatorBefore: true,
  });
  if (!readOnly.value) {
    const many = target.rowIds.length > 1;
    if (target.rowIds.length > 0 && target.rowIds.every((id) => staging.isDeleting(id))) {
      actions.push({
        id: "keep",
        label: many ? `Keep these ${target.rowIds.length} rows` : "Keep this row",
        separatorBefore: true,
      });
    } else {
      actions.push({
        id: "delete",
        label: many ? `Delete ${target.rowIds.length} rows` : "Delete row",
        binding: "delete",
        danger: true,
        separatorBefore: true,
      });
    }
  }
  return actions;
}

function recordsFor(rowIds: readonly string[]): Record<string, unknown>[] {
  const ids = new Set(rowIds);
  return mapped.value.rows.filter((row) => ids.has(row.id)).map((row) => ({ ...row.cells }));
}

function runContextAction(actionId: string, target: GridContextTarget) {
  if (actionId === "open-group") filterToGroup(target.rowId);
  else if (actionId.startsWith("filter:") && target.columnId) {
    const operator = actionId.slice("filter:".length) as PredicateOperator;
    try {
      props.query.addFilter(target.columnId, operator, target.value);
    } catch (error) {
      toast.error("Could not filter on this value", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (actionId === "copy-insert") void props.query.copyAsInsert(recordsFor(target.rowIds));
  else if (actionId === "row-diff" && target.rowId) showRowChanges(target.rowId);
  else if (actionId === "delete") requestDelete([...target.rowIds]);
  else if (actionId === "keep") staging.keepRows(target.rowIds);
  else if (actionId === "undo-cell" && target.rowId && target.columnId) {
    staging.undoCell(target.rowId, target.columnId);
  } else if (actionId === "set-null" && target.rowId && target.columnId) {
    staging.setNull(target.rowId, target.columnId);
  }
}

function requestDelete(rowIds: string[]) {
  if (readOnly.value) return;
  staging.deleteRows(rowIds);
}

function exportRows(format: SqliteExportFormat, scope: SqliteExportScope) {
  if (scope === "all") {
    void props.query.exportTable(format);
    return;
  }
  const ids = columns.value.map((column) => column.id);
  const records = recordsFor(summary.value.selectedRowIds);
  const values = records.map((record) => ids.map((id) => record[id]));
  const stem = fileStem(props.databaseName, props.tableName, "selected");
  try {
    if (format === "csv") downloadText(toCsv(ids, values), `${stem}.csv`, "text/csv");
    else if (format === "sql") {
      downloadText(toSqliteInserts(props.tableName, ids, values), `${stem}.sql`, "application/sql");
    } else downloadText(JSON.stringify(records, null, 2), `${stem}.json`, "application/json");
    toast.success(`Exported ${records.length} rows`, { description: `${stem}.${format}` });
  } catch (error) {
    toast.error("Could not export the rows", {
      description: error instanceof Error ? error.message : String(error),
    });
  }
}

const grid = ref<InstanceType<typeof DataGrid> | null>(null);
const paneView = ref<InstanceType<typeof RecordPane> | null>(null);
const pane = useRecordPane({
  rows: recordRows,
  grid,
  page: computed(() => props.query.page.value),
  hasMore: computed(() => props.hasMore),
  pagingEnabled: computed(() => grouped.value === null),
  setPage: (page) => (props.query.page.value = page),
});
const maximized = ref(false);
const paneShown = computed(() => pane.visible.value && paneRow.value !== null);
watch(paneShown, (shown) => {
  if (!shown) maximized.value = false;
});

const keyColumnNames = computed(() =>
  props.columnInfo
    .filter((column) => column.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((column) => column.name),
);
const paneRow = computed(() => recordRows.value.find((row) => row.id === pane.rowId.value) ?? null);
const paneChange = computed(() =>
  pane.rowId.value ? (props.changesByRowKey?.get(pane.rowId.value) ?? null) : null,
);
const paneTitle = computed(() => {
  const row = paneRow.value;
  if (!row) return "";
  return (
    recordKeyLabel(keyColumnNames.value, row.cells) ?? `row ${offset.value + pane.index.value + 1}`
  );
});
const paneSubtitle = computed(() => {
  if (pane.index.value < 0) return "not in the rows shown";
  return grouped.value
    ? `in a group of ${grouped.value}`
    : `row ${offset.value + pane.index.value + 1}`;
});
const paneState = computed(() => {
  const change = paneChange.value;
  const seen = change ? Date.parse(change.observedAt) : Number.NaN;
  return recordStateWords(
    pane.rowId.value ? rowStates.value.get(pane.rowId.value) : undefined,
    change
      ? { source: change.source, seen: Number.isNaN(seen) ? "" : formatExactTime(seen) }
      : null,
  );
});
const paneDocument = computed(() => {
  const row = paneRow.value;
  return row
    ? Object.fromEntries(columns.value.map((column) => [column.id, row.cells[column.id]]))
    : null;
});
const paneBefore = computed(() =>
  paneChange.value ? { value: paneChange.value.beforeValue } : null,
);

const goToRow = ref<InstanceType<typeof SqliteGoToRow> | null>(null);
const pendingReveal = ref<SqliteRowReveal | null>(null);

function revealNow() {
  const target = pendingReveal.value;
  if (!target || grouped.value) return;
  let rowId: string | undefined;
  if ("rowId" in target) {
    rowId = mapped.value.rows.some((row) => row.id === target.rowId) ? target.rowId : undefined;
  } else if (!props.stale && !props.loading) {
    rowId = mapped.value.rows[target.index]?.id;
  }
  if (!rowId) return;
  pendingReveal.value = null;
  const found = rowId;
  pane.show(found);
  void nextTick(() => grid.value?.focusRow(found));
}

watch([() => mapped.value.rows, () => props.stale, () => props.loading], revealNow);

/** Lands on a row once its page is on screen, and opens it in the record pane. */
function reveal(target: SqliteRowReveal) {
  pendingReveal.value = target;
  revealNow();
}

function showRowChanges(rowId: string) {
  pane.show(rowId);
  void nextTick(() => paneView.value?.showChanges());
}

function closePane() {
  maximized.value = false;
  pane.close();
}

function onPaneKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  event.stopPropagation();
  closePane();
}

function onGridKeydown(event: KeyboardEvent) {
  if (event.key !== " " || !event.shiftKey || event.ctrlKey || event.metaKey || event.altKey)
    return;
  if (!pane.rowId.value) return;
  event.preventDefault();
  event.stopPropagation();
  pane.show(pane.rowId.value);
  maximized.value = !maximized.value;
}

const summary = shallowRef<GridSummary>({
  rowCount: 0,
  selectedRows: 0,
  selectedRowIds: [],
  selectedCells: 0,
  aggregate: null,
});

const sort = computed<GridSort | null>(() => props.query.gridSort.value);
const noMatch = computed(() => {
  const parts = [
    ...props.query.filters.value.map((chip) => chip.label),
    ...(props.query.whereClause.value ? [`WHERE ${props.query.whereClause.value}`] : []),
    ...(props.query.search.value ? [`the search “${props.query.search.value}”`] : []),
  ];
  return parts.length ? `No rows match ${parts.join(" and ")}` : "No rows match";
});

function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "s") {
    if (staging.pending.value === 0) return;
    event.preventDefault();
    void staging.save();
  }
}

defineExpose({
  focusSearch: () => toolbar.value?.focusSearch(),
  openWhere: () => toolbar.value?.openWhere(),
  openGoToRow: () => goToRow.value?.open(),
  reveal,
  edits: {
    canEdit: () => !readOnly.value,
    pending: () => staging.pending.value,
    addRow: () => void staging.addRow(),
    save: () => void staging.save(),
    discard: () => staging.discardWithUndo(),
  } satisfies SqliteEditCommands,
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col" @keydown="onKeydown">
    <SqliteEditBar
      v-if="!readOnly"
      :pending="staging.pending.value"
      :saving="staging.saving.value"
      :note="staging.note.value"
      :saves-to="savesTo ?? null"
      :unsaved="unsaved === true"
      @add-row="staging.addRow()"
      @discard="staging.discardWithUndo()"
      @save="staging.save()"
      @save-file="emit('fileAction', 'save-file')"
      @save-as="emit('fileAction', 'save-as')"
    />
    <SqliteBrowseToolbar
      ref="toolbar"
      v-model:visibility="visibility"
      :query="query"
      :groups="groups"
      :columns="columns"
      :selected-rows="summary.selectedRows"
      :filter-error="filterError"
      @export="exportRows"
    >
      <template #lead><slot name="lead" /></template>
      <template #changes><slot name="changes" /></template>
      <template #trail><slot name="trail" /></template>
    </SqliteBrowseToolbar>
    <DataState
      v-if="error && !result && !filterError"
      kind="error"
      :title="`Could not read “${tableName}”`"
      :detail="error"
      @retry="emit('retry')"
    />
    <RecordSplit v-else :pane-open="paneShown" :maximized="maximized">
      <template #grid>
        <div class="h-full min-h-0" @keydown.capture="onGridKeydown">
          <DataGrid
            ref="grid"
            frame="none"
            :label="tableName"
            :columns="columns"
            :rows="visibleRows"
            :loading="loading"
            :read-only="readOnly"
            :row-states="rowStates"
            :sort="sort"
            :row-number-offset="offset"
            :column-visibility="visibility"
            :show-as="showAs"
            :grouped-column="grouped"
            :column-features="{ filter: true, group: true, showAs: true }"
            :context-actions="contextActions"
            :layout-key="`sqlite:${stateKey}/${tableName}`"
            :editing="staging.editing.value"
            @edit="staging.startEdit"
            @update:sort="query.setSort($event)"
            @column-action="onColumnAction"
            @active-row="$event && (pane.activeRowId.value = $event)"
            @pick="pane.show"
            @inspect="pane.show"
            @toggle-section="groups.toggle"
            @note-action="groups.noteAction"
            @summary="summary = $event"
            @delete="requestDelete"
            @context-action="runContextAction"
          >
            <template #editor="{ rowId, column, value }">
              <CellEditor
                :key="`${rowId}:${column.id}`"
                :value="value"
                :like="staging.sampleOf(column.id)"
                :kind="staging.editorKind(column.id, value)"
                exact-integers
                :label="`Edit ${column.title}`"
                @commit="staging.commit"
                @cancel="staging.cancel()"
                @rejected="staging.say"
                @save="staging.save()"
              />
            </template>
            <template #empty>
              <div v-if="query.needsQuery.value" class="flex flex-col items-start gap-2">
                <span>{{ noMatch }}</span>
                <Button size="sm" variant="transparent" @click="query.clearFilters()">
                  Clear filters
                </Button>
              </div>
              <template v-else>{{
                result ? `“${tableName}” has no rows` : "No rows read yet"
              }}</template>
            </template>
          </DataGrid>
        </div>
      </template>
      <template #pane>
        <div class="h-full min-h-0" @keydown="onPaneKeydown">
          <template v-if="paneRow">
            <RecordPane
              ref="paneView"
              :key="`${stateKey}/${tableName}`"
              :title="paneTitle"
              :subtitle="paneSubtitle"
              :state-text="paneState"
              :columns="columns"
              :cells="paneRow.cells"
              :value="paneDocument"
              :read-only-reason="lockReason"
              :json-editable="false"
              :can-delete="false"
              :before="paneBefore"
              :can-prev="pane.canPrev.value"
              :can-next="pane.canNext.value"
              maximizable
              :maximized="maximized"
              @prev="pane.step(-1)"
              @next="pane.step(1)"
              @close="closePane"
              @maximize="maximized = $event"
              @follow-foreign-key="(target, value) => emit('followForeignKey', target, value)"
            />
          </template>
        </div>
      </template>
    </RecordSplit>
    <DataGridStatus :summary="summary" :total="total" hide-count>
      <template #lead>
        <DataPager
          :page="query.page.value"
          :page-size="query.pageSize.value"
          :has-more="hasMore"
          :rows-on-page="result?.rows.length ?? 0"
          :total="total"
          @update:page="query.page.value = $event"
          @update:page-size="query.setPageSize($event)"
        />
      </template>
      <span v-if="grouped" class="text-cladd-fg-soft">groups of {{ grouped }}</span>
      <HintTooltip v-if="lockReason" :text="lockReason">
        <span class="flex items-center gap-1" tabindex="0">
          <Lock :size="11" aria-hidden="true" />
          read-only
        </span>
      </HintTooltip>
      <span v-if="result" class="tabular-nums">{{ result.durationMs }} ms</span>
      <SqliteGoToRow
        ref="goToRow"
        :key-columns="keyColumnNames"
        :blocked="null"
        @go="emit('goToRow', $event)"
      />
      <DataFreshness :provenance="provenance" :read-at="readAt" :watched="watched" />
      <IconAction
        :label="pane.open.value ? 'Hide the record pane' : 'Show the record pane'"
        size="sm"
        :pressed="pane.open.value"
        @click="pane.open.value ? closePane() : (pane.open.value = true)"
      >
        <PanelRight :stroke-width="1.8" />
      </IconAction>
    </DataGridStatus>
  </div>
</template>
