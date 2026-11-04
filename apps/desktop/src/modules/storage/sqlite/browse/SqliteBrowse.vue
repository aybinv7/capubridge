<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { Download, Lock, PanelRight } from "lucide-vue-next";
import { Button, Popover } from "@capubridge/cladd";
import {
  DataGrid,
  DataGridColumnsMenu,
  DataGridInspector,
  DataGridStatus,
  type GridContextAction,
  type GridContextTarget,
  type GridRowState,
  type GridSort,
  type GridSummary,
} from "@/shared/components/data/grid";
import ProvenanceTag from "@/components/gate/ProvenanceTag.vue";
import { readPersisted, writePersisted } from "@/lib/persisted";
import type { Provenance } from "@/lib/provenance";
import type {
  SqliteColumnInfo,
  SqliteForeignKeyInfo,
  SqliteQueryResult,
} from "@/types/sqlite.types";
import type { SqliteRecordChange } from "@/types/sqliteChanges.types";
import { toGridColumns, toGridRows } from "./sqliteGrid";
import { predicate, type PredicateOperator, type SqliteExportFormat } from "./sqliteQuery";
import SqliteFilterBar from "./SqliteFilterBar.vue";

const INSPECTOR_KEY = "capubridge:sqlite-inspector";

const props = defineProps<{
  tableName: string;
  result: SqliteQueryResult | null;
  columnInfo: readonly SqliteColumnInfo[];
  foreignKeys: readonly SqliteForeignKeyInfo[];
  loading: boolean;
  sort: GridSort | null;
  /** Absolute index of the first row on this page. */
  offset: number;
  /** True row count of the table (`COUNT(*)`), when known. */
  total: number | null;
  changesByRowKey?: ReadonlyMap<string, SqliteRecordChange>;
  /** Why the table cannot be edited here; `null` when edits reach the source. */
  readOnlyReason: string | null;
  provenance: Provenance;
  /** Show only rows the device changed while this table was watched. */
  changesOnly?: boolean;
  /** Applied SQL WHERE clause. */
  where: string;
  filterError: string | null;
}>();

const emit = defineEmits<{
  "update:sort": [sort: GridSort | null];
  followForeignKey: [target: string, value: unknown];
  delete: [records: Record<string, unknown>[]];
  "update:where": [where: string];
  addFilter: [clause: string];
  export: [format: SqliteExportFormat];
  copyInsert: [records: Record<string, unknown>[]];
  openRowDiff: [rowKey: string];
}>();

const visibility = ref<Record<string, boolean>>({});
watch(
  () => props.tableName,
  () => {
    visibility.value = {};
  },
);

const FILTER_ACTIONS: Array<{ id: PredicateOperator; label: string }> = [
  { id: "=", label: "Filter: equals this value" },
  { id: "!=", label: "Filter: not this value" },
  { id: "null", label: "Filter: is NULL" },
  { id: "not-null", label: "Filter: is not NULL" },
];

function contextActions(target: GridContextTarget): GridContextAction[] {
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
  if (target.rowId && rowStates.value.has(target.rowId)) {
    actions.push({ id: "row-diff", label: "Show what the device changed", separatorBefore: true });
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
    actions.push({
      id: "delete",
      label: target.rowIds.length > 1 ? `Delete ${target.rowIds.length} rows` : "Delete row",
      binding: "delete",
      danger: true,
      separatorBefore: true,
    });
  }
  return actions;
}

function recordsFor(rowIds: readonly string[]): Record<string, unknown>[] {
  const ids = new Set(rowIds);
  return mapped.value.rows.filter((row) => ids.has(row.id)).map((row) => ({ ...row.cells }));
}

function runContextAction(actionId: string, target: GridContextTarget) {
  if (actionId.startsWith("filter:") && target.columnId) {
    const operator = actionId.slice("filter:".length) as PredicateOperator;
    emit("addFilter", predicate(target.columnId, operator, target.value));
  } else if (actionId === "copy-insert") {
    emit("copyInsert", recordsFor(target.rowIds));
  } else if (actionId === "row-diff" && target.rowId) {
    emit("openRowDiff", target.rowId);
  } else if (actionId === "delete") {
    emit("delete", recordsFor(target.rowIds));
  }
}

const columns = computed(() =>
  toGridColumns(props.result?.columns ?? [], props.columnInfo, props.foreignKeys),
);
const mapped = computed(() =>
  props.result
    ? toGridRows(props.result, props.columnInfo, props.offset)
    : { rows: [], identified: true },
);

const rowStates = computed(() => {
  const states = new Map<string, GridRowState>();
  if (!props.changesByRowKey) return states;
  for (const row of mapped.value.rows) {
    if (props.changesByRowKey.has(row.id)) states.set(row.id, "recent");
  }
  return states;
});

const visibleRows = computed(() =>
  props.changesOnly
    ? mapped.value.rows.filter((row) => rowStates.value.has(row.id))
    : mapped.value.rows,
);

function requestDelete(rowIds: string[]) {
  emit("delete", recordsFor(rowIds));
}

const readOnly = computed(() => props.readOnlyReason !== null || !mapped.value.identified);
const lockReason = computed(
  () =>
    props.readOnlyReason ??
    (mapped.value.identified
      ? null
      : "This table has no primary key, so rows cannot be addressed."),
);

const inspectorOpen = ref(
  readPersisted<boolean>(INSPECTOR_KEY, true, (v) => typeof v === "boolean"),
);
watch(inspectorOpen, (open) => writePersisted(INSPECTOR_KEY, open));

const activeRowId = ref<string | null>(null);
const activeRow = computed(
  () => mapped.value.rows.find((row) => row.id === activeRowId.value) ?? null,
);
const summary = shallowRef<GridSummary>({
  rowCount: 0,
  selectedRows: 0,
  selectedCells: 0,
  aggregate: null,
});

function inspect(rowId: string) {
  activeRowId.value = rowId;
  inspectorOpen.value = !inspectorOpen.value;
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      class="flex shrink-0 items-start gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-chrome)] px-3 py-1.5"
    >
      <SqliteFilterBar :where="where" :error="filterError" @apply="emit('update:where', $event)" />
      <DataGridColumnsMenu v-model:visibility="visibility" :columns="columns" />
      <Popover position="bottom-end" content-class-name="w-48 p-1">
        <template #trigger>
          <Button size="sm" variant="transparent" :outline="false" content-class-name="gap-1.5">
            <Download :size="13" aria-hidden="true" />
            Export
          </Button>
        </template>
        <template #default="{ close }">
          <div class="flex flex-col">
            <p class="px-2 pt-1 pb-1.5 text-2xs text-[var(--fg-subtle)]">
              {{ where ? "Rows matching the filter" : "Every row of the table" }}
            </p>
            <Button
              v-for="format in ['csv', 'json', 'sql'] as const"
              :key="format"
              size="sm"
              variant="transparent"
              :outline="false"
              content-class-name="w-full justify-start"
              @click="
                emit('export', format);
                close();
              "
            >
              {{ format === "sql" ? "SQL INSERT statements" : format.toUpperCase() }}
            </Button>
          </div>
        </template>
      </Popover>
    </div>
    <div class="flex min-h-0 flex-1">
      <div class="min-w-0 flex-1" :class="provenance === 'local' && 'prov-local'">
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
          :context-actions="contextActions"
          @update:sort="emit('update:sort', $event)"
          @active-row="activeRowId = $event"
          @inspect="inspect"
          @summary="summary = $event"
          @delete="requestDelete"
          @context-action="runContextAction"
        >
          <template #empty>
            <div v-if="where" class="flex flex-col items-start gap-2">
              <span
                >No rows match <code class="font-mono text-foreground">{{ where }}</code></span
              >
              <Button size="sm" variant="transparent" @click="emit('update:where', '')">
                Clear filter
              </Button>
            </div>
            <template v-else>{{
              result ? `"${tableName}" has no rows` : "No rows loaded"
            }}</template>
          </template>
        </DataGrid>
      </div>
      <DataGridInspector
        v-if="inspectorOpen"
        class="w-80 shrink-0"
        :columns="columns"
        :row="activeRow"
        :title="tableName"
        :state="activeRowId ? rowStates.get(activeRowId) : undefined"
        @close="inspectorOpen = false"
        @follow-foreign-key="(target, value) => emit('followForeignKey', target, value)"
      />
    </div>
    <DataGridStatus :summary="summary" :total="total">
      <span v-if="lockReason" class="flex items-center gap-1" :title="lockReason">
        <Lock :size="11" aria-hidden="true" />
        read-only
      </span>
      <ProvenanceTag :kind="provenance" />
      <span v-if="result" class="tabular-nums">{{ result.durationMs }} ms</span>
      <Button
        size="2xs"
        square
        variant="transparent"
        :outline="false"
        :pressed="inspectorOpen"
        :aria-label="inspectorOpen ? 'Hide inspector' : 'Show inspector'"
        :title="inspectorOpen ? 'Hide inspector (Space)' : 'Show inspector (Space)'"
        @click="inspectorOpen = !inspectorOpen"
      >
        <PanelRight :size="12" aria-hidden="true" />
      </Button>
    </DataGridStatus>
  </div>
</template>
