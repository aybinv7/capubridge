<script setup lang="ts">
import { computed, ref } from "vue";
import { RefreshCw } from "lucide-vue-next";
import { Button, Spinner } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import DataFreshness from "@/modules/storage/frame/DataFreshness.vue";
import DataRowMenu from "@/modules/storage/frame/DataRowMenu.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import type { DataAction, DataProvenance } from "@/modules/storage/frame/dataFrame.types";
import type { SqliteColumnInfo, SqliteDbFile, SqliteTableInfo } from "@/types/sqlite.types";
import { useSqliteUnsavedStore } from "@/modules/storage/stores/useSqliteUnsavedStore";
import type { SqliteStaged } from "./browse/sqliteChangeset";
import SqliteDatabasePane from "./SqliteDatabasePane.vue";
import SqliteSourceBadge from "./SqliteSourceBadge.vue";
import SqliteTablePane from "./SqliteTablePane.vue";
import type { SqliteAddress } from "./sqliteAddress";
import type { SqliteLanding } from "./sqliteLanding";
import type { SqliteEditCommands } from "./useSqliteCommands";
import type { SqliteDatabaseView, SqliteTableView } from "./useSqliteLocation";
import SqliteTabStrip from "./tabs/SqliteTabStrip.vue";
import { stripTabs } from "./tabs/sqliteStripTabs";
import type { useSqliteTabs } from "./workspace/useSqliteTabs";

/**
 * The open database as a workspace of tabs: the strip (Overview, tables, SQL, Diagram) with the
 * database's freshness, Read again and menu at its right end, then the active tab's body. Up to
 * four table tabs stay mounted (`KeepAlive`); the others come back from what their tab kept.
 */
const props = defineProps<{
  db: SqliteDbFile;
  sourceId: string;
  address: SqliteAddress;
  tables: readonly SqliteTableInfo[];
  tablesLoading: boolean;
  tablesLoaded: boolean;
  tablesFetching: boolean;
  tablesError: string | null;
  tablesReadAt: number | null;
  table: string;
  tableView: SqliteTableView;
  databaseView: SqliteDatabaseView;
  provenance: DataProvenance;
  databaseActions: readonly DataAction[];
  tableActions: readonly DataAction[];
  changeSerial: string;
  changePackage: string;
  owner: { serial: string; packageName: string };
  tablePath: (table: string) => string;
  saveChanges: (
    table: string,
    keyColumns: readonly SqliteColumnInfo[],
    staged: SqliteStaged,
  ) => Promise<boolean>;
  landing: SqliteLanding | null;
  tabs: ReturnType<typeof useSqliteTabs>;
  /** The 5 s check keeps this copy current; when it last checked and last saw a change. */
  watched: boolean;
  checkedAt: number | null;
  changedAt: number | null;
}>();

const emit = defineEmits<{
  setView: [view: SqliteTableView];
  followLink: [landing: SqliteLanding];
  landed: [];
  action: [id: string, table: string | null];
  refresh: [];
  fileAction: [action: "save-file" | "save-as"];
}>();

const PANEL_ID = "sqlite-tab-panel";

const pane = ref<{
  focusSearch: () => void;
  openWhere?: () => void;
  openGoToRow?: () => void;
  edits?: () => SqliteEditCommands | null;
} | null>(null);

const unsaved = useSqliteUnsavedStore();
const byName = computed(() => new Map(props.tables.map((table) => [table.name, table])));
const tableNames = computed(() => new Set(byName.value.keys()));
const info = computed(() => byName.value.get(props.table));
const gone = computed(() => props.table !== "" && props.tablesLoaded && !info.value);

const TABLE_PREFIX = "table:";
const DATABASE_PREFIX = "db:";

/**
 * One ⋯ menu for the open database: the shown table's actions first, then the database's,
 * so the tab strip and the table toolbar never both carry one.
 */
const menuActions = computed<DataAction[]>(() => {
  const forTable =
    props.table && info.value
      ? props.tableActions.map((action) => ({ ...action, id: `${TABLE_PREFIX}${action.id}` }))
      : [];
  const forDatabase = props.databaseActions.map((action, index) => ({
    ...action,
    id: `${DATABASE_PREFIX}${action.id}`,
    separatorBefore: index === 0 ? forTable.length > 0 : action.separatorBefore,
  }));
  return [...forTable, ...forDatabase];
});

function onMenu(id: string) {
  if (id.startsWith(TABLE_PREFIX)) emit("action", id.slice(TABLE_PREFIX.length), props.table);
  else emit("action", id.slice(DATABASE_PREFIX.length), null);
}

const strip = computed(() =>
  stripTabs({
    tabs: props.tabs.state.value.tabs,
    activeId: props.tabs.activeId.value,
    tables: byName.value,
    staged: new Map(
      unsaved.stagedIn(props.sourceId).map((entry) => [entry.table, entry.count] as const),
    ),
  }),
);

defineExpose({
  focusSearch: () => pane.value?.focusSearch(),
  openWhere: () => pane.value?.openWhere?.(),
  openGoToRow: () => pane.value?.openGoToRow?.(),
  edits: () => pane.value?.edits?.() ?? null,
});
</script>

<template>
  <SqliteTabStrip
    :tabs="strip"
    :database-name="db.name"
    :can-reopen="tabs.state.value.closed.length > 0"
    :panel-id="PANEL_ID"
    @select="tabs.select"
    @close="tabs.close(new Set([$event]))"
    @keep="tabs.keep"
    @close-others="tabs.closeOthers"
    @close-to-right="tabs.closeToRight"
    @close-all="tabs.closeAll()"
    @reopen="tabs.reopen()"
  >
    <template #end>
      <SqliteSourceBadge :db="db" />
      <DataFreshness
        :provenance="provenance"
        :read-at="tablesReadAt"
        :checked-at="watched ? checkedAt : null"
        :changed-at="changedAt"
      />
      <Spinner v-if="tablesFetching && !tablesLoading" size="xs" aria-label="Reading again" />
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
        v-if="menuActions.length"
        :actions="menuActions"
        :label="table ? `Actions for ${table} and ${db.name}` : `Actions for ${db.name}`"
        @select="onMenu"
      />
    </template>
  </SqliteTabStrip>

  <div
    :id="PANEL_ID"
    role="tabpanel"
    :aria-labelledby="`sqlite-tab-${tabs.activeId.value}`"
    class="flex min-h-0 flex-1 flex-col"
  >
    <DataState
      v-if="gone"
      kind="empty"
      :title="`“${table}” is not in the database any more`"
      text="It was dropped or renamed since the tab was opened."
    >
      <Button size="sm" variant="solid" @click="tabs.close(new Set([`table:${table}`]))">
        Close the tab
      </Button>
    </DataState>
    <KeepAlive v-else :max="4">
      <SqliteTablePane
        v-if="table"
        ref="pane"
        :key="`${sourceId}::table:${table}`"
        :db="db"
        :database-id="sourceId"
        :address="address"
        :table="table"
        :info="info"
        :table-names="tableNames"
        :view="tableView"
        :provenance="provenance"
        :actions="tableActions"
        :change-serial="changeSerial"
        :change-package="changePackage"
        :save-changes="(keys, staged) => saveChanges(table, keys, staged)"
        :landing="landing"
        :initial-query="tabs.queryOf(table)"
        @set-view="emit('setView', $event)"
        @open-table="tabs.openTable($event, { keep: true })"
        @follow-link="emit('followLink', $event)"
        @landed="emit('landed')"
        @query-change="tabs.rememberQuery(table, $event)"
        @action="emit('action', $event, table)"
        @file-action="emit('fileAction', $event)"
      />
    </KeepAlive>
    <KeepAlive :max="3">
      <SqliteDatabasePane
        v-if="!table"
        ref="pane"
        :key="`${sourceId}::${databaseView}`"
        :db="db"
        :database-id="sourceId"
        :address="address"
        :tables="tables"
        :loading="tablesLoading"
        :loaded="tablesLoaded"
        :error="tablesError"
        :view="databaseView"
        :owner="owner"
        :table-path="tablePath"
        :change-serial="changeSerial"
        :change-package="changePackage"
        :watched="watched"
        @open-table="(name, keep) => tabs.openTable(name, { keep })"
        @refresh="emit('refresh')"
      />
    </KeepAlive>
  </div>
</template>
