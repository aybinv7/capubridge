<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { Lock, PanelRight } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { toast } from "vue-sonner";
import {
  DataGrid,
  DataGridInspector,
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
import ConfirmDialog from "@/shared/components/presentation/ConfirmDialog.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import DataPager from "@/modules/storage/frame/DataPager.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import { recordPaneOpen } from "@/modules/storage/frame/recordPaneOpen";
import { useDataConfirm } from "@/modules/storage/frame/useDataConfirm";
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
import {
  predicate,
  type PredicateOperator,
  type SqliteExportFormat,
  type SqliteExportScope,
} from "./sqliteQuery";
import type { SqliteTableQuery } from "./useSqliteTableQuery";
import SqliteBrowseToolbar from "./SqliteBrowseToolbar.vue";
import SqliteColumnFilter from "./SqliteColumnFilter.vue";
import SqliteEditBar from "./SqliteEditBar.vue";
import type { SqliteStaged } from "./sqliteChangeset";
import type { SqliteEditCommands } from "../useSqliteCommands";
import { useSqliteStagedEdits } from "./useSqliteStagedEdits";

const SHOW_AS_KEY = "capubridge:sqlite-show-as";

/** The rows of one table: filter bar, search, the grid with its inspector, and the pager. */
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
  /** Saves staged edits and new rows to the opened file; resolves whether it saved. */
  saveChanges: (staged: SqliteStaged) => Promise<boolean>;
  /** The file an opened file saves to, or `null` for a phone or page copy. */
  savesTo?: string | null;
  /** The opened file's working copy holds changes its file does not have yet. */
  unsaved?: boolean;
}>();

const emit = defineEmits<{
  followForeignKey: [target: string, value: unknown];
  openRowDiff: [rowKey: string];
  retry: [];
  fileAction: [action: "save-file" | "save-as"];
}>();

const grouped = computed(() => props.query.groupBy.value);
const offset = computed(() => props.query.page.value * props.query.pageSize.value);

const columns = computed(() => {
  const base = toGridColumns(props.result?.columns ?? [], props.columnInfo, props.foreignKeys);
  return grouped.value
    ? base.map((column) =>
        column.id === "rows" ? { ...column, title: "rows", type: "integer" as const } : column,
      )
    : base;
});

const mapped = computed(() =>
  props.result
    ? toGridRows(props.result, grouped.value ? [] : props.columnInfo, offset.value)
    : { rows: [], identified: true },
);

const readOnly = computed(
  () => grouped.value !== null || props.readOnlyReason !== null || !mapped.value.identified,
);

const staging = useSqliteStagedEdits({
  rows: computed(() => mapped.value.rows),
  columns,
  showAs: computed(() => showAs.value),
  writable: computed(() => !readOnly.value),
  save: (staged) => props.saveChanges(staged),
});

const unsavedTables = useSqliteUnsavedStore();
watch(
  () => staging.pending.value,
  (count) =>
    unsavedTables.track(props.databaseId, props.tableName, {
      count,
      discard: () => staging.discard(),
    }),
  { immediate: true },
);
onBeforeUnmount(() => unsavedTables.track(props.databaseId, props.tableName, null));

const rowStates = computed(() => {
  const states = new Map<string, GridRowState>();
  if (grouped.value) return states;
  if (props.changesByRowKey) {
    for (const row of mapped.value.rows) {
      if (props.changesByRowKey.has(row.id)) states.set(row.id, "recent");
    }
  }
  for (const [rowId, state] of staging.states.value) states.set(rowId, state);
  return states;
});

const shownRows = computed(() => (grouped.value ? mapped.value.rows : staging.rows.value));

const visibleRows = computed(() =>
  props.changesOnly && !grouped.value
    ? shownRows.value.filter((row) => rowStates.value.has(row.id))
    : shownRows.value,
);
const lockReason = computed(() => {
  if (grouped.value) return null;
  return (
    props.readOnlyReason ??
    (mapped.value.identified
      ? null
      : "This table has no primary key, so a row cannot be told apart.")
  );
});

const visibility = ref<Record<string, boolean>>({});

const showAsTable = computed(() => `${props.stateKey}/${props.tableName}`);
const showAsAll = ref(
  readPersisted<Record<string, Record<string, GridColumnType>>>(
    SHOW_AS_KEY,
    {},
    (value) => typeof value === "object" && value !== null && !Array.isArray(value),
  ),
);
const showAs = computed(() => showAsAll.value[showAsTable.value] ?? {});

watch(
  () => props.tableName,
  () => {
    visibility.value = {};
    filterColumn.value = null;
  },
);

function setShowAs(columnId: string, type: GridColumnType | null) {
  const current = { ...showAs.value };
  if (type) current[columnId] = type;
  else delete current[columnId];
  showAsAll.value = { ...showAsAll.value, [showAsTable.value]: current };
  writePersisted(SHOW_AS_KEY, showAsAll.value);
}

const toolbar = ref<InstanceType<typeof SqliteBrowseToolbar> | null>(null);
const filterColumn = ref<string | null>(null);

function onColumnAction(columnId: string, action: GridColumnMenuAction) {
  if (action.kind === "filter") filterColumn.value = columnId;
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

function groupValue(rowId: string | null): unknown {
  const column = grouped.value;
  const row = mapped.value.rows.find((entry) => entry.id === rowId);
  return column && row ? row.cells[column] : undefined;
}

function contextActions(target: GridContextTarget): GridContextAction[] {
  if (grouped.value) {
    return [{ id: "open-group", label: "Show the rows in this group", separatorBefore: true }];
  }
  const actions: GridContextAction[] = [];
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
  if (actionId === "open-group") props.query.openGroup(groupValue(target.rowId));
  else if (actionId.startsWith("filter:") && target.columnId) {
    const operator = actionId.slice("filter:".length) as PredicateOperator;
    try {
      props.query.addFilter(predicate(target.columnId, operator, target.value));
    } catch (error) {
      toast.error("Could not filter on this value", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (actionId === "copy-insert") void props.query.copyAsInsert(recordsFor(target.rowIds));
  else if (actionId === "row-diff" && target.rowId) emit("openRowDiff", target.rowId);
  else if (actionId === "delete") requestDelete([...target.rowIds]);
  else if (actionId === "keep") staging.keepRows(target.rowIds);
}

function openGroupRow(rowId: string) {
  if (grouped.value) props.query.openGroup(groupValue(rowId));
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

const activeRowId = ref<string | null>(null);
const activeRow = computed(
  () => shownRows.value.find((row) => row.id === activeRowId.value) ?? null,
);
const summary = shallowRef<GridSummary>({
  rowCount: 0,
  selectedRows: 0,
  selectedRowIds: [],
  selectedCells: 0,
  aggregate: null,
});

function inspect(rowId: string) {
  activeRowId.value = rowId;
  recordPaneOpen.value = true;
}

const sort = computed<GridSort | null>(() => (grouped.value ? null : props.query.gridSort.value));
const where = computed(() => props.query.whereClause.value);

const confirm = useDataConfirm();

async function leaveWithChanges(): Promise<boolean> {
  const count = staging.pending.value;
  if (count === 0) return true;
  const leave = await confirm.askAsync({
    title: count === 1 ? "Leave 1 change unsaved?" : `Leave ${count} changes unsaved?`,
    text: `The changes to “${props.tableName}” are not in the file yet. Leaving drops them.`,
    confirmLabel: "Drop the changes",
    danger: true,
  });
  if (leave) staging.discard();
  return leave;
}

onBeforeRouteLeave(leaveWithChanges);
onBeforeRouteUpdate(leaveWithChanges);

function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "s") {
    if (staging.pending.value === 0) return;
    event.preventDefault();
    void staging.save();
  }
}

defineExpose({
  focusSearch: () => toolbar.value?.focusSearch(),
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
      :columns="columns"
      :selected-rows="summary.selectedRows"
      :filter-error="filterError"
      @export="exportRows"
    />
    <SqliteColumnFilter
      :column="filterColumn"
      :anchor="toolbar?.anchor ?? null"
      @apply="query.addFilter($event)"
      @close="filterColumn = null"
    />
    <DataState
      v-if="error && !result && !filterError"
      kind="error"
      :title="`Could not read “${tableName}”`"
      :detail="error"
      @retry="emit('retry')"
    />
    <div v-else class="flex min-h-0 flex-1 gap-2 p-2">
      <div class="min-w-0 flex-1">
        <DataGrid
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
          :column-features="{ filter: !grouped, group: true, showAs: true }"
          :context-actions="contextActions"
          :activate-rows="grouped !== null"
          :layout-key="`sqlite:${stateKey}/${tableName}`"
          :editing="staging.editing.value"
          @edit="staging.startEdit"
          @update:sort="query.setSort($event)"
          @column-action="onColumnAction"
          @active-row="activeRowId = $event"
          @inspect="inspect"
          @activate="openGroupRow"
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
              <span>
                No rows match
                <code v-if="where" class="font-mono text-cladd-fg">{{ where }}</code>
                <template v-if="query.search.value">
                  {{ where ? " and " : "" }}the search “{{ query.search.value }}”</template
                >
              </span>
              <Button
                size="sm"
                variant="transparent"
                @click="
                  query.setWhere('');
                  query.setSearch('');
                "
              >
                Clear filters
              </Button>
            </div>
            <template v-else>{{
              result ? `“${tableName}” has no rows` : "No rows read yet"
            }}</template>
          </template>
        </DataGrid>
      </div>
      <DataGridInspector
        v-if="recordPaneOpen && !grouped"
        class="w-80 shrink-0"
        :columns="columns"
        :row="activeRow"
        :title="tableName"
        :state="activeRowId ? rowStates.get(activeRowId) : undefined"
        @close="recordPaneOpen = false"
        @follow-foreign-key="(target, value) => emit('followForeignKey', target, value)"
      />
    </div>
    <DataGridStatus :summary="summary" :total="total" hide-count>
      <DataPager
        :page="query.page.value"
        :page-size="query.pageSize.value"
        :has-more="hasMore"
        :rows-on-page="result?.rows.length ?? 0"
        :total="total"
        @update:page="query.page.value = $event"
        @update:page-size="query.setPageSize($event)"
      />
      <span v-if="grouped" class="text-cladd-fg-soft">groups of {{ grouped }}</span>
      <HintTooltip v-if="lockReason" :text="lockReason">
        <span class="flex items-center gap-1" tabindex="0">
          <Lock :size="11" aria-hidden="true" />
          read-only
        </span>
      </HintTooltip>
      <span v-if="result" class="tabular-nums">{{ result.durationMs }} ms</span>
      <IconAction
        :label="recordPaneOpen ? 'Hide the record pane' : 'Show the record pane'"
        size="sm"
        :pressed="recordPaneOpen"
        @click="recordPaneOpen = !recordPaneOpen"
      >
        <PanelRight :stroke-width="1.8" />
      </IconAction>
    </DataGridStatus>
    <ConfirmDialog
      v-model:open="confirm.open.value"
      :request="confirm.request.value"
      @confirm="confirm.confirm()"
    />
  </div>
</template>
