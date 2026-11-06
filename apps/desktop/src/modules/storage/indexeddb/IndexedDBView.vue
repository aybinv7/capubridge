<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useRouter } from "vue-router";
import { Database, FolderOpen, Table2 } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import ConfirmDialog from "@/shared/components/presentation/ConfirmDialog.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useActiveContextStore } from "@/stores/activeContext.store";
import DataSourceTree from "@/modules/storage/frame/DataSourceTree.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import DataWorkbench from "@/modules/storage/frame/DataWorkbench.vue";
import { useDataConfirm } from "@/modules/storage/frame/useDataConfirm";
import { useDataPresence } from "@/modules/storage/frame/useDataPresence";
import { dataScope, useDataSidebarSettings } from "@/modules/storage/frame/useDataSidebarSettings";
import type { DataTreeRow } from "@/modules/storage/frame/dataFrame.types";
import { useIndexedDBChangeIndex } from "@/modules/storage/changes/useIndexedDBChangeOverlay";
import { useIndexedDBChangesLease } from "@/modules/storage/changes/useIndexedDBChangesTracking";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import { buildStoreKey } from "@/modules/storage/changes/indexeddbChanges.service";
import IdbDatabaseView from "./IdbDatabaseView.vue";
import IdbStoreView from "./IdbStoreView.vue";
import {
  buildIdbSections,
  countsByStore,
  fileSourceId,
  liveSourceId,
  selectionFor,
  sourceRoute,
} from "./idbTreeModel";
import { idbTreeActions, runIdbTreeAction } from "./idbTreeActions";
import { useIdbCatalog } from "./useIdbCatalog";
import { useIdbCommands } from "./useIdbCommands";
import { useIdbDatabaseActions } from "./useIdbDatabaseActions";
import { useIdbLocation } from "./useIdbLocation";
import { toggleRecordPane } from "@/modules/storage/frame/recordPaneOpen";

const router = useRouter();
const location = useIdbLocation();
const presence = useDataPresence();
const catalog = useIdbCatalog(
  location,
  computed(() => presence.away.value === null),
);
const settings = useDataSidebarSettings();
const changes = useIndexedDBChangesStore();
const context = useActiveContextStore();
const confirm = useDataConfirm();
const { getDatabaseSummary, getStoreSummary } = useIndexedDBChangeIndex();

useIndexedDBChangesLease();

const root = ref<HTMLElement | null>(null);
const storeView = ref<InstanceType<typeof IdbStoreView> | null>(null);
const search = ref("");

const hasPhone = computed(() => Boolean(catalog.targetId.value));

const scope = computed(() =>
  dataScope(
    context.device?.serial ?? catalog.targetId.value,
    context.target?.packageName ?? "",
    "indexeddb",
  ),
);
const showHidden = computed({
  get: () => settings.showHidden(scope.value),
  set: (value: boolean) => settings.setShowHidden(scope.value, value),
});

const owner = computed(() => ({
  serial: context.device?.serial ?? "",
  packageName: context.target?.packageName ?? "",
}));

function storePath(store: string): string {
  const open = catalog.openDatabase.value;
  return open ? location.storePath(open.mode, open.id, store) : "/storage/indexeddb";
}

const openSourceId = computed(() => {
  const open = catalog.openDatabase.value;
  if (!open) return null;
  return open.mode === "file" ? fileSourceId(open.id) : liveSourceId(open);
});

watch(
  openSourceId,
  (sourceId) => {
    if (sourceId) settings.setExpanded(scope.value, sourceId, true);
  },
  { immediate: true },
);

const sections = computed(() =>
  buildIdbSections({
    live: catalog.liveDatabases.value,
    hasPhone: hasPhone.value,
    files: catalog.files.value,
    settings: (sourceId) => settings.source(scope.value, sourceId),
    databaseChanges: (origin, db) => getDatabaseSummary(origin, db),
    storeChanges: (origin, db, store) => getStoreSummary(origin, db, store),
    storeWatched: (origin, db, store) =>
      changes.getSnapshot(buildStoreKey(origin, db, store))?.tracked,
    counts: countsByStore(catalog.storeInfo.value),
    openSourceId: openSourceId.value,
  }),
);

const selection = computed(() =>
  selectionFor(
    location.mode.value,
    location.database.value,
    location.store.value,
    catalog.origin.value,
    catalog.liveDatabases.value,
  ),
);

const missing = computed(
  () =>
    Boolean(location.database.value) &&
    !catalog.openDatabase.value &&
    (location.mode.value === "file" ||
      (!catalog.liveLoading.value && !catalog.liveError.value && presence.away.value === null)),
);

const actions = useIdbDatabaseActions({
  targetId: catalog.targetId,
  origin: catalog.origin,
  liveDatabases: catalog.liveDatabases,
  ask: confirm.ask,
  openLocation: location.open,
  replaceRoot: location.replaceRoot,
  current: () => ({
    mode: location.mode.value,
    database: location.database.value,
    store: location.store.value,
  }),
  refetchDatabases: catalog.refetchDatabases,
  refetchStoreInfo: catalog.refetchStoreInfo,
  refetchRecords: () => storeView.value?.refresh(),
});

const treeContext = computed(() => ({
  scope: scope.value,
  hasPhone: hasPhone.value,
  live: catalog.liveDatabases.value,
  files: catalog.files.value,
  settings,
  changes,
  actions,
}));

function actionsFor(row: DataTreeRow) {
  return idbTreeActions(row, treeContext.value);
}

function onTreeAction(actionId: string, row: DataTreeRow) {
  runIdbTreeAction(actionId, row, treeContext.value);
}

const openRow = computed<DataTreeRow | null>(() => {
  const open = catalog.openDatabase.value;
  const sourceId = openSourceId.value;
  if (!open || !sourceId) return null;
  const source = sections.value
    .flatMap((section) => section.sources)
    .find((entry) => entry.id === sourceId);
  if (!source) return null;
  const collection = source.collections.find((entry) => entry.id === location.store.value);
  return collection
    ? { kind: "collection", key: "", source, collection, sectionId: "" }
    : { kind: "source", key: "", source, sectionId: "" };
});

const visibleSources = computed(() =>
  sections.value.flatMap((section) => section.sources).filter((source) => !source.hidden),
);

function onSelect(sourceId: string, collectionId: string | null) {
  const target = sourceRoute(sourceId, catalog.liveDatabases.value);
  if (!target) return;
  const db = catalog.liveDatabases.value.find((entry) => liveSourceId(entry) === sourceId);
  if (db) catalog.origin.value = db.origin;
  settings.setExpanded(scope.value, sourceId, true);
  location.open(target.mode, target.id, collectionId ?? "");
}

function onToggle(sourceId: string, expanded: boolean) {
  settings.setExpanded(scope.value, sourceId, expanded);
}

const queryClient = useQueryClient();

/** Reads the database again; its diagram's sample is read again too (B7). */
function refreshDatabase() {
  void catalog.refetchStoreInfo();
  void queryClient.invalidateQueries({ queryKey: ["idb-diagram"] });
}

function refreshAll() {
  void catalog.refetchDatabases();
  refreshDatabase();
  void storeView.value?.refresh();
}

function backToList() {
  location.replaceRoot(hasPhone.value ? "live" : "file");
}

function findHere(): boolean {
  const element = root.value;
  const active = document.activeElement;
  if (!element) return false;
  if (!active || active === document.body || active === document.documentElement) return true;
  return element.contains(active) && !active.closest("[data-record-pane]");
}

useIdbCommands({
  hasStore: () => Boolean(location.store.value),
  canRefresh: () => location.mode.value === "live" && hasPhone.value,
  refresh: refreshAll,
  focusSearch: () => storeView.value?.focusSearch(),
  findHere,
  toggleRecordPane,
});
</script>

<template>
  <div ref="root" class="h-full min-h-0">
    <DataWorkbench kind="indexeddb">
      <template #sidebar>
        <DataSourceTree
          v-model:search="search"
          v-model:show-hidden="showHidden"
          :sections="sections"
          :selection="selection"
          :loading="catalog.liveLoading.value && presence.away.value === null"
          :error="presence.away.value === null ? catalog.liveError.value : null"
          search-label="Find a database or store"
          :source-icon="Database"
          :collection-icon="Table2"
          :actions-for="actionsFor"
          @select="onSelect"
          @toggle="onToggle"
          @action="onTreeAction"
          @link="router.push($event)"
          @retry="catalog.refetchDatabases()"
        >
          <template #tools>
            <IconAction
              label="Open an IndexedDB export…"
              hint="Read-only, no phone needed"
              @click="actions.openExport()"
            >
              <FolderOpen :stroke-width="1.8" />
            </IconAction>
          </template>
          <template #empty>
            <p class="text-xs text-muted-foreground">
              {{ hasPhone ? "This page has no IndexedDB databases." : "No export is open." }}
            </p>
            <Button
              size="sm"
              variant="transparent"
              class="mt-2 self-start"
              @click="actions.openExport()"
            >
              Open an export…
            </Button>
          </template>
        </DataSourceTree>
      </template>

      <DataState
        v-if="missing"
        kind="empty"
        :title="
          location.mode.value === 'file'
            ? 'This file is no longer open'
            : `“${location.database.value}” is not on this page`
        "
        :text="
          location.mode.value === 'file'
            ? 'Opened files last until Capubridge closes.'
            : 'It may have been deleted, or it belongs to another app.'
        "
      >
        <Button size="sm" variant="transparent" @click="backToList">Back to IndexedDB</Button>
      </DataState>
      <DataState
        v-else-if="!catalog.openDatabase.value && presence.away.value && hasPhone"
        kind="waiting"
        title="Waiting for the app"
        :text="presence.away.value"
      >
        <Button
          size="sm"
          variant="solid-fill"
          color="brand"
          :loading="presence.bringing.value"
          @click="presence.bringToFront()"
        >
          Bring to front
        </Button>
      </DataState>
      <DataState
        v-else-if="!catalog.openDatabase.value && catalog.liveLoading.value && hasPhone"
        kind="loading"
        title="Reading the page's databases"
      />
      <DataState
        v-else-if="!catalog.openDatabase.value && visibleSources.length === 0"
        kind="empty"
        :title="hasPhone ? 'This page keeps nothing in IndexedDB' : 'No export is open'"
        :text="
          hasPhone
            ? 'Its data may be in Key-value (Local storage, LocalForage) or in SQLite. An IndexedDB export can be opened here too.'
            : 'Open an IndexedDB export to read it here, with no phone connected.'
        "
      >
        <Button size="sm" variant="transparent" @click="actions.openExport()">
          Open an export…
        </Button>
        <Button
          v-if="hasPhone"
          size="sm"
          variant="transparent"
          @click="router.push({ name: 'storage-keyvalue' })"
        >
          Key-value
        </Button>
        <Button
          v-if="hasPhone"
          size="sm"
          variant="transparent"
          @click="router.push({ name: 'storage-sqlite' })"
        >
          SQLite
        </Button>
      </DataState>
      <DataState
        v-else-if="!catalog.openDatabase.value"
        kind="empty"
        :title="`${visibleSources.length} ${visibleSources.length === 1 ? 'database' : 'databases'} in the list`"
        text="Pick one in the list to see its stores and sizes, or a store to read and edit its records."
      />
      <IdbDatabaseView
        v-else-if="!location.store.value"
        :database="catalog.openDatabase.value"
        :stores="catalog.storeInfo.value"
        :loading="catalog.storeInfoLoading.value"
        :error="catalog.storeInfoError.value"
        :idb-usage="catalog.idbUsage.value"
        :read-at="catalog.storeInfoReadAt.value"
        :actions="openRow ? actionsFor(openRow) : []"
        :view="location.databaseView.value"
        :target-id="catalog.targetId.value"
        :owner="owner"
        :store-path="storePath"
        @set-view="location.setDatabaseView"
        @open="
          location.open(catalog.openDatabase.value.mode, catalog.openDatabase.value.id, $event)
        "
        @refresh="refreshDatabase()"
        @action="openRow && onTreeAction($event, openRow)"
      />
      <IdbStoreView
        v-else
        ref="storeView"
        :key="`${catalog.openDatabase.value.mode}:${catalog.openDatabase.value.id}/${location.store.value}`"
        :target-id="catalog.targetId.value"
        :database="catalog.openDatabase.value"
        :store="location.store.value"
        :info="catalog.openStoreInfo.value"
        :info-loading="catalog.storeInfoLoading.value"
        :actions="openRow ? actionsFor(openRow) : []"
        :ask="confirm.ask"
        :confirm="confirm.askAsync"
        @action="openRow && onTreeAction($event, openRow)"
        @after-write="catalog.refetchStoreInfo()"
      />
    </DataWorkbench>

    <ConfirmDialog
      v-model:open="confirm.open.value"
      :request="confirm.request.value"
      @confirm="confirm.confirm()"
    />
  </div>
</template>
