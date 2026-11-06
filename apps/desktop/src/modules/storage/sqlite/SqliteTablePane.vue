<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, ref, watch } from "vue";
import { toast } from "vue-sonner";
import ChangeSummary from "@/modules/storage/frame/ChangeSummary.vue";
import type { DataAction, DataProvenance } from "@/modules/storage/frame/dataFrame.types";
import { useSqliteTableChangeOverlay } from "@/modules/storage/changes/useSqliteChangeOverlay";
import { orderKeyColumns } from "@/modules/storage/changes/sqliteRowKey";
import type { SqliteColumnInfo, SqliteDbFile, SqliteTableInfo } from "@/types/sqlite.types";
import SqliteBrowse from "./browse/SqliteBrowse.vue";
import type { SqliteStaged } from "./browse/sqliteChangeset";
import { sqliteReadOnlyReason } from "./browse/sqliteWriteAccess";
import { useSqliteGroupRows } from "./browse/useSqliteGroupRows";
import { useSqliteRows } from "./browse/useSqliteRows";
import { rowOrderOf } from "./browse/sqliteRowOrder";
import { useSqliteTableQuery } from "./browse/useSqliteTableQuery";
import SqliteSqlPane from "./SqliteSqlPane.vue";
import SqliteStructure from "./SqliteStructure.vue";
import SqliteTableActions from "./SqliteTableActions.vue";
import SqliteTableViewSwitch from "./SqliteTableViewSwitch.vue";
import type { SqliteAddress } from "./sqliteAddress";
import { runQuery } from "./sqliteReads";
import { useSqliteColumns, useSqliteStructure } from "./useSqliteCatalog";
import type { SqliteTableView } from "./useSqliteLocation";
import { parseRowTarget } from "./quick/sqliteKeyInput";
import { predicate } from "./browse/sqliteQuery";
import { useSqliteGoToRow, type SqliteRowReveal } from "./browse/useSqliteGoToRow";
import { linkLanding, type SqliteLanding } from "./sqliteLanding";
import type { SqliteQueryState } from "./workspace/sqliteTabs";

/**
 * One table of the open database: its rows, its structure, or free SQL. The table's name is not
 * repeated here (the sidebar selection names it); the view switch, the change summary, Read
 * again and the table's menu sit in the toolbar, and the rows' freshness in the status bar.
 */
const props = defineProps<{
  db: SqliteDbFile;
  databaseId: string;
  address: SqliteAddress | null;
  table: string;
  info: SqliteTableInfo | undefined;
  tableNames: ReadonlySet<string>;
  view: SqliteTableView;
  provenance: DataProvenance;
  actions: readonly DataAction[];
  changeSerial: string;
  changePackage: string;
  saveChanges: (keyColumns: readonly SqliteColumnInfo[], staged: SqliteStaged) => Promise<boolean>;
  /** A row to land on once the table is read: from a link, or `table:key` in quick open. */
  landing?: SqliteLanding | null;
  /** What the tab kept of the query when it was last shown. */
  initialQuery?: SqliteQueryState;
}>();

const emit = defineEmits<{
  setView: [view: SqliteTableView];
  openTable: [table: string];
  followLink: [landing: SqliteLanding];
  landed: [];
  queryChange: [state: SqliteQueryState];
  action: [id: string];
  fileAction: [action: "save-file" | "save-as"];
}>();

const address = computed(() => props.address);
const table = computed(() => props.table);
const changesOnly = ref(false);
const stateKey = computed(() =>
  props.db.sourceKind === "imported"
    ? `file:${props.db.sourceFilePath ?? props.db.name}`
    : props.databaseId,
);
const browse = ref<InstanceType<typeof SqliteBrowse> | null>(null);
const sql = ref<InstanceType<typeof SqliteSqlPane> | null>(null);

const { columns } = useSqliteColumns(address, table);
const structure = useSqliteStructure(address, table, ref(true));

const rowOrder = computed(() => rowOrderOf(props.info, columns.value));
const query = useSqliteTableQuery({
  run: (statement, fullValues) => {
    const current = address.value;
    if (!current) return Promise.reject(new Error("No database is open"));
    return runQuery(current, statement, fullValues);
  },
  table,
  database: computed(() => props.db.name),
  currentColumns: () => rows.page.value?.result.columns ?? null,
  allColumns: () => columns.value.map((column) => column.name),
  rowOrder: () => rowOrder.value,
});
if (props.initialQuery) query.restore(props.initialQuery);
watch(query.state, (state) => emit("queryChange", state));

const shown = ref(true);
onActivated(() => (shown.value = true));
onDeactivated(() => (shown.value = false));

const rows = useSqliteRows({
  address,
  table,
  query,
  tableRowCount: computed(() => props.info?.rowCount ?? null),
  rowOrder,
  active: shown,
});

const groups = useSqliteGroupRows({
  address,
  table,
  query,
  rowOrder,
  columnInfo: columns,
  groupPage: computed(() => (query.groupBy.value ? (rows.page.value?.result ?? null) : null)),
  stateKey: computed(() => `${stateKey.value}/${props.table}`),
  active: shown,
});

const keyColumns = computed(() => orderKeyColumns([...columns.value]));
const { changesByRowKey, tableSummary } = useSqliteTableChangeOverlay({
  serial: computed(() => props.changeSerial),
  packageName: computed(() => props.changePackage),
  dbPath: computed(() => props.db.path),
  tableName: table,
  pkColumns: keyColumns,
});

watch(
  () => tableSummary.value.total,
  (total) => {
    if (total === 0) changesOnly.value = false;
  },
);

function reveal(target: SqliteRowReveal) {
  if (props.view !== "rows") emit("setView", "rows");
  void nextTick(() => browse.value?.reveal(target));
}

const goToRow = useSqliteGoToRow({
  address,
  table,
  query,
  rowOrder,
  keyColumns: computed(() => keyColumns.value.map((column) => column.name)),
  reveal,
});

/** `table.column` of a link, split on a table this database has (names may hold dots). */
function linkTarget(target: string): { table: string; column: string } | null {
  let best: string | null = null;
  for (const name of props.tableNames) {
    if (target.startsWith(`${name}.`) && (!best || name.length > best.length)) best = name;
  }
  return best ? { table: best, column: target.slice(best.length + 1) } : null;
}

function followForeignKey(target: string, value: unknown) {
  const link = linkTarget(target);
  if (link) emit("followLink", linkLanding(link.table, link.column, value));
}

async function land(landing: SqliteLanding) {
  if (landing.kind === "key") {
    const target = parseRowTarget(landing.key, keyColumns.value.length);
    if (target) await goToRow.goTo(target);
    return;
  }
  try {
    await goToRow.goToMatch(
      predicate(landing.column, "=", landing.value),
      `${landing.column} ${landing.label}`,
    );
  } catch (error) {
    toast.error("Could not follow the link", {
      description: error instanceof Error ? error.message : String(error),
    });
  }
}

watch(
  () => [props.landing, columns.value.length > 0, props.info !== undefined] as const,
  ([landing, read, listed]) => {
    if (!landing || !read || !listed || landing.table !== props.table) return;
    emit("landed");
    void land(landing);
  },
  { immediate: true },
);

defineExpose({
  edits: () => (props.view === "rows" ? (browse.value?.edits ?? null) : null),
  focusSearch: () => {
    if (props.view === "sql") sql.value?.focus();
    else {
      emit("setView", "rows");
      browse.value?.focusSearch();
    }
  },
  openGoToRow: () => {
    if (props.view !== "rows") emit("setView", "rows");
    void nextTick(() => browse.value?.openGoToRow());
  },
  openWhere: () => {
    if (props.view !== "rows") emit("setView", "rows");
    void nextTick(() => browse.value?.openWhere());
  },
});
</script>

<template>
  <SqliteBrowse
    v-if="view === 'rows'"
    ref="browse"
    :table-name="table"
    :database-id="databaseId"
    :state-key="stateKey"
    :database-name="db.name"
    :result="rows.page.value?.result ?? null"
    :has-more="rows.page.value?.hasMore ?? false"
    :total="rows.total.value"
    :column-info="columns"
    :foreign-keys="structure.structure.value?.foreignKeys ?? []"
    :loading="rows.loading.value"
    :error="rows.error.value"
    :filter-error="rows.filterError.value"
    :changes-by-row-key="changesByRowKey"
    :read-only-reason="sqliteReadOnlyReason(db)"
    :changes-only="changesOnly"
    :query="query"
    :groups="groups"
    :save-changes="(staged) => saveChanges(keyColumns, staged)"
    :saves-to="db.sourceFilePath ?? null"
    :unsaved="db.unsavedToSource === true"
    :provenance="provenance"
    :read-at="rows.readAt.value"
    :stale="rows.placeholder.value"
    @file-action="emit('fileAction', $event)"
    @follow-foreign-key="followForeignKey"
    @go-to-row="goToRow.goTo"
    @retry="rows.refetch()"
  >
    <template #lead>
      <SqliteTableViewSwitch :view="view" @set-view="emit('setView', $event)" />
    </template>
    <template #changes>
      <ChangeSummary v-model:changes-only="changesOnly" :changes="tableSummary" />
    </template>
    <template #trail>
      <SqliteTableActions :table="table" :actions="actions" @action="emit('action', $event)" />
    </template>
  </SqliteBrowse>
  <div v-else class="flex shrink-0 items-center gap-2 border-b border-cladd-outline px-2 py-1.5">
    <SqliteTableViewSwitch :view="view" @set-view="emit('setView', $event)" />
    <span class="flex-1" />
    <SqliteTableActions :table="table" :actions="actions" @action="emit('action', $event)" />
  </div>
  <SqliteStructure
    v-if="view === 'structure'"
    :structure="structure.structure.value"
    :create-sql="info?.sql ?? ''"
    :loading="structure.loading.value"
    :error="structure.error.value"
    :table-names="tableNames"
    @open-table="emit('openTable', $event)"
    @retry="structure.refetch()"
  />
  <SqliteSqlPane
    v-else-if="view === 'sql'"
    ref="sql"
    :address="address"
    :database-id="databaseId"
    :database-name="db.name"
    :table="table"
  />
</template>
