<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Database, FolderOpen, Table2 } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import ConfirmDialog from "@/shared/components/presentation/ConfirmDialog.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import DataSourceTree from "@/modules/storage/frame/DataSourceTree.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import DataWorkbench from "@/modules/storage/frame/DataWorkbench.vue";
import { toggleRecordPane } from "@/modules/storage/frame/recordPaneOpen";
import { useDataConfirm } from "@/modules/storage/frame/useDataConfirm";
import type { DataProvenance, DataTreeRow } from "@/modules/storage/frame/dataFrame.types";
import { openSqliteFile } from "./openSqliteFile";
import SqliteDatabasePane from "./SqliteDatabasePane.vue";
import SqliteTablePane from "./SqliteTablePane.vue";
import { sqliteTreeActions } from "./sqliteTreeActions";
import { useSqliteCommands } from "./useSqliteCommands";
import { sqliteRouteTo } from "./useSqliteLocation";
import { useSqliteTab } from "./useSqliteTab";
import { useSqliteTreeHandlers } from "./useSqliteTreeHandlers";

const router = useRouter();
const confirm = useDataConfirm();
const tab = useSqliteTab();
const { location, current, address, tables } = tab;
const handlers = useSqliteTreeHandlers(tab, confirm.askAsync);

const root = ref<HTMLElement | null>(null);
const pane = ref<{ focusSearch: () => void } | null>(null);
const search = ref("");

const showHidden = computed({
  get: () => tab.settings.showHidden(tab.scope.value),
  set: (value: boolean) => tab.settings.setShowHidden(tab.scope.value, value),
});

const selection = computed(() =>
  current.value
    ? { sourceId: current.value.sourceId, collectionId: location.table.value || null }
    : null,
);

const provenance = computed<DataProvenance>(() => {
  const db = current.value?.db;
  if (!db) return "local";
  if (db.sourceKind === "imported") return "imported";
  return db.unreachable ? "stale" : "local";
});

const tableNames = computed(() => new Set(tables.tables.value.map((table) => table.name)));
const tableInfo = computed(() =>
  tables.tables.value.find((table) => table.name === location.table.value),
);
const owner = computed(() => ({
  serial: tab.device.value?.serial ?? "",
  packageName: tab.device.value?.package ?? "",
}));

function tablePath(table: string): string {
  const target = location.target.value;
  return target ? router.resolve(sqliteRouteTo(target, table)).fullPath : "/storage/sqlite";
}

const databaseCount = computed(() => tab.sources.databases.value.length + tab.fileCount.value);

function actionsFor(row: DataTreeRow) {
  return sqliteTreeActions(row, {
    databaseOf: tab.databaseOf,
    unreadableReason: handlers.unreadableReason,
    openSourceId: current.value?.sourceId ?? null,
  });
}

const openSource = computed(() => {
  const open = current.value;
  if (!open) return null;
  for (const section of tab.sections.value) {
    const found = section.sources.find((entry) => entry.id === open.sourceId);
    if (found) return found;
  }
  return null;
});

function headerRow(table: string): DataTreeRow | null {
  const source = openSource.value;
  if (!source) return null;
  if (!table) return { kind: "source", key: "", source, sectionId: "" };
  const collection = source.collections.find((entry) => entry.id === table) ?? {
    id: table,
    label: table,
  };
  return { kind: "collection", key: "", source, collection, sectionId: "" };
}

const headerActions = computed(() => {
  const row = headerRow(location.table.value);
  return row ? actionsFor(row).filter((action) => action.id !== "refresh") : [];
});

function headerAction(actionId: string) {
  const row = headerRow(location.table.value);
  if (row) handlers.run(actionId, row);
}

function findHere(): boolean {
  const element = root.value;
  const active = document.activeElement;
  if (!element) return false;
  if (!active || active === document.body || active === document.documentElement) return true;
  return element.contains(active) && !active.closest("[data-record-pane]");
}

useSqliteCommands({
  hasDatabase: () => current.value !== null,
  canExport: () => address.value !== null,
  refresh: () => void handlers.refresh(),
  focusFind: () => pane.value?.focusSearch(),
  findHere,
  togglePane: toggleRecordPane,
  exportFile: () => current.value && handlers.exportFile(current.value.db),
  exportDump: () => current.value && handlers.exportDump(current.value.db),
});
</script>

<template>
  <div ref="root" class="h-full min-h-0">
    <DataWorkbench kind="sqlite">
      <template #sidebar>
        <DataSourceTree
          v-model:search="search"
          v-model:show-hidden="showHidden"
          :sections="tab.sections.value"
          :selection="selection"
          :loading="tab.sources.loading.value"
          :error="tab.sources.error.value"
          search-label="Find a database or table"
          :source-icon="Database"
          :collection-icon="Table2"
          :actions-for="actionsFor"
          @select="handlers.select"
          @toggle="handlers.toggle"
          @action="handlers.run"
          @retry="tab.sources.refetch()"
        >
          <template #tools>
            <IconAction
              label="Open a SQLite file…"
              hint="Read a database file from this computer"
              @click="openSqliteFile(router)"
            >
              <FolderOpen :stroke-width="1.8" />
            </IconAction>
          </template>
          <template #empty>
            <p class="text-xs text-muted-foreground">
              {{ tab.device.value ? "This app has no SQLite database." : "No app is selected." }}
            </p>
          </template>
        </DataSourceTree>
      </template>

      <DataState
        v-if="tab.missing.value"
        kind="empty"
        title="This database cannot be shown"
        :text="tab.missing.value"
      >
        <Button size="sm" variant="transparent" @click="location.open(null)"
          >Back to the list</Button
        >
        <Button
          v-if="location.onFileRoute.value"
          size="sm"
          variant="solid-fill"
          color="brand"
          @click="openSqliteFile(router)"
        >
          Open a SQLite file…
        </Button>
      </DataState>
      <template v-else-if="current">
        <DataState
          v-if="!address && tab.opening.isOpening(current.db)"
          kind="loading"
          :title="`Copying “${current.db.name}” from the page`"
        />
        <DataState
          v-else-if="!address"
          kind="empty"
          :title="`“${current.db.name}” is not read yet`"
          :text="handlers.unreadableReason(current.db) ?? undefined"
        >
          <Button
            v-if="current.db.sourceKind === 'opfs' || current.db.sourceKind === 'jeep-sqlite'"
            size="sm"
            variant="solid-fill"
            color="brand"
            @click="tab.opening.open(current.db)"
          >
            Copy it from the page
          </Button>
        </DataState>
        <SqliteTablePane
          v-else-if="location.table.value"
          ref="pane"
          :key="`${current.sourceId}::${location.table.value}`"
          :db="current.db"
          :database-id="current.sourceId"
          :address="address"
          :table="location.table.value"
          :info="tableInfo"
          :table-names="tableNames"
          :view="location.tableView.value"
          :provenance="provenance"
          :actions="headerActions"
          :change-serial="tab.changeSerial.value"
          :change-package="tab.changePackage.value"
          :delete-rows="(keys, records) => handlers.deleteRows(location.table.value, keys, records)"
          :save-changes="(keys, staged) => handlers.saveChanges(location.table.value, keys, staged)"
          @set-view="location.setView"
          @open-table="handlers.openTable"
          @action="headerAction"
          @refresh="handlers.refresh()"
        />
        <SqliteDatabasePane
          v-else
          ref="pane"
          :key="current.sourceId"
          :db="current.db"
          :database-id="current.sourceId"
          :address="address"
          :tables="tables.tables.value"
          :loading="tables.loading.value"
          :loaded="tables.loaded.value"
          :fetching="tables.fetching.value"
          :error="tables.error.value"
          :read-at="tables.readAt.value"
          :view="location.databaseView.value"
          :provenance="provenance"
          :actions="headerActions"
          :owner="owner"
          :table-path="tablePath"
          @set-view="location.setView"
          @open-table="handlers.openTable"
          @action="headerAction"
          @refresh="handlers.refresh()"
        />
      </template>
      <DataState
        v-else-if="databaseCount > 0"
        kind="empty"
        title="Choose a database"
        :text="`${databaseCount} ${databaseCount === 1 ? 'database is' : 'databases are'} in the list. Pick one to see its tables.`"
      />
      <DataState
        v-else-if="!tab.sources.loading.value"
        kind="empty"
        :title="tab.device.value ? 'This app has no SQLite database' : 'No app to read'"
        text="Its databases folder and its page hold no SQLite file. A file on this computer can still be opened."
      >
        <Button size="sm" variant="solid-fill" color="brand" @click="openSqliteFile(router)">
          Open a SQLite file…
        </Button>
      </DataState>
      <DataState v-else kind="loading" title="Looking for databases" />
    </DataWorkbench>

    <ConfirmDialog
      v-model:open="confirm.open.value"
      :request="confirm.request.value"
      @confirm="confirm.confirm()"
    />
  </div>
</template>
