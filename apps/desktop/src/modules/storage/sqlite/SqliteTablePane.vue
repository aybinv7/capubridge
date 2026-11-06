<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RefreshCw } from "lucide-vue-next";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import ChangeSummary from "@/modules/storage/frame/ChangeSummary.vue";
import DataCollectionHeader from "@/modules/storage/frame/DataCollectionHeader.vue";
import DataRowMenu from "@/modules/storage/frame/DataRowMenu.vue";
import type { DataAction, DataProvenance } from "@/modules/storage/frame/dataFrame.types";
import { useSqliteTableChangeOverlay } from "@/modules/storage/changes/useSqliteChangeOverlay";
import { orderKeyColumns } from "@/modules/storage/changes/sqliteRowKey";
import type { SqliteColumnInfo, SqliteDbFile, SqliteTableInfo } from "@/types/sqlite.types";
import SqliteBrowse from "./browse/SqliteBrowse.vue";
import type { SqliteStaged } from "./browse/sqliteChangeset";
import { sqliteReadOnlyReason } from "./browse/sqliteWriteAccess";
import { useSqliteRows } from "./browse/useSqliteRows";
import { rowOrderOf } from "./browse/sqliteRowOrder";
import { useSqliteTableQuery } from "./browse/useSqliteTableQuery";
import SqliteSqlPane from "./SqliteSqlPane.vue";
import SqliteStructure from "./SqliteStructure.vue";
import type { SqliteAddress } from "./sqliteAddress";
import { runQuery } from "./sqliteReads";
import { useSqliteColumns, useSqliteStructure } from "./useSqliteCatalog";
import type { SqliteTableView } from "./useSqliteLocation";

/** One table of the open database: its header, then its rows, its structure, or free SQL. */
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
}>();

const emit = defineEmits<{
  setView: [view: SqliteTableView];
  openTable: [table: string];
  action: [id: string];
  refresh: [];
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
const rows = useSqliteRows({
  address,
  table,
  query,
  tableRowCount: computed(() => props.info?.rowCount ?? null),
  rowOrder,
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

function followForeignKey(target: string) {
  const name = target.split(".")[0];
  if (name && props.tableNames.has(name)) emit("openTable", name);
}

const identity = computed(() => {
  const kind = props.info?.tableType === "view" ? "view" : "table";
  return `${kind} in ${props.db.name}`;
});

defineExpose({
  edits: () => (props.view === "rows" ? (browse.value?.edits ?? null) : null),
  focusSearch: () => {
    if (props.view === "sql") sql.value?.focus();
    else {
      emit("setView", "rows");
      browse.value?.focusSearch();
    }
  },
});
</script>

<template>
  <DataCollectionHeader
    :title="table"
    :identity="identity"
    :provenance="provenance"
    :read-at="rows.readAt.value"
    :busy="rows.fetching.value && !rows.loading.value"
  >
    <ChangeSummary v-model:changes-only="changesOnly" :changes="tableSummary" />
    <template #actions>
      <Segmented size="xs" active-variant="solid" aria-label="What to show of the table">
        <SegmentedButton :active="view === 'rows'" @click="emit('setView', 'rows')"
          >Rows</SegmentedButton
        >
        <SegmentedButton :active="view === 'structure'" @click="emit('setView', 'structure')">
          Structure
        </SegmentedButton>
        <SegmentedButton :active="view === 'sql'" @click="emit('setView', 'sql')"
          >SQL</SegmentedButton
        >
      </Segmented>
      <IconAction
        label="Read again"
        :hint="
          db.sourceKind === 'imported'
            ? 'Reads the file again'
            : 'Copies the database again and compares it'
        "
        @click="emit('refresh')"
      >
        <RefreshCw :stroke-width="1.8" />
      </IconAction>
      <DataRowMenu
        v-if="actions.length"
        :actions="actions"
        :label="`Actions for ${table}`"
        @select="emit('action', $event)"
      />
    </template>
  </DataCollectionHeader>

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
    :save-changes="(staged) => saveChanges(keyColumns, staged)"
    :saves-to="db.sourceFilePath ?? null"
    :unsaved="db.unsavedToSource === true"
    @file-action="emit('fileAction', $event)"
    @follow-foreign-key="followForeignKey"
    @retry="rows.refetch()"
  />
  <SqliteStructure
    v-else-if="view === 'structure'"
    :structure="structure.structure.value"
    :create-sql="info?.sql ?? ''"
    :loading="structure.loading.value"
    :error="structure.error.value"
    :table-names="tableNames"
    @open-table="emit('openTable', $event)"
    @retry="structure.refetch()"
  />
  <SqliteSqlPane
    v-else
    ref="sql"
    :address="address"
    :database-id="databaseId"
    :database-name="db.name"
    :table="table"
  />
</template>
