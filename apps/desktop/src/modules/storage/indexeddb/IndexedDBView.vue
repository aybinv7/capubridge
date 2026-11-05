<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useEventListener } from "@vueuse/core";
import { Database, FolderOpen, Table2 } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import ConfirmDialog from "@/shared/components/presentation/ConfirmDialog.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useActiveContextStore } from "@/stores/activeContext.store";
import DataSourceTree from "@/modules/storage/frame/DataSourceTree.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import DataWorkbench from "@/modules/storage/frame/DataWorkbench.vue";
import { useDataConfirm } from "@/modules/storage/frame/useDataConfirm";
import { dataScope, useDataSidebarSettings } from "@/modules/storage/frame/useDataSidebarSettings";
import type { DataTreeRow } from "@/modules/storage/frame/dataFrame.types";
import { useIndexedDBChangeIndex } from "@/modules/storage/changes/useIndexedDBChangeOverlay";
import { useIndexedDBChangesLease } from "@/modules/storage/changes/useIndexedDBChangesTracking";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
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
import { toggleRecordPane } from "./useIdbRecordPane";

const router = useRouter();
const location = useIdbLocation();
const catalog = useIdbCatalog(location);
const settings = useDataSidebarSettings();
const changes = useIndexedDBChangesStore();
const context = useActiveContextStore();
const confirm = useDataConfirm();
const { getDatabaseSummary, getStoreSummary } = useIndexedDBChangeIndex();

useIndexedDBChangesLease();

const root = ref<HTMLElement | null>(null);
const storeView = ref<InstanceType<typeof IdbStoreView> | null>(null);
const search = ref("");

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

const openSourceId = computed(() => {
  const open = catalog.openDatabase.value;
  if (!open) return null;
  return open.mode === "file" ? fileSourceId(open.id) : liveSourceId(open);
});

const sections = computed(() =>
  buildIdbSections({
    live: catalog.liveDatabases.value,
    hasPhone: Boolean(catalog.targetId.value),
    files: catalog.files.value,
    settings: (sourceId) => settings.source(scope.value, sourceId),
    databaseChanges: (origin, db) => getDatabaseSummary(origin, db),
    storeChanges: (origin, db, store) => getStoreSummary(origin, db, store),
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
    (location.mode.value === "file" || !catalog.liveLoading.value),
);

const actions = useIdbDatabaseActions({
  targetId: catalog.targetId,
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

function onSelect(sourceId: string, collectionId: string | null) {
  const target = sourceRoute(sourceId, catalog.liveDatabases.value);
  if (!target) return;
  const db = catalog.liveDatabases.value.find((entry) => liveSourceId(entry) === sourceId);
  if (db) catalog.origin.value = db.origin;
  location.open(target.mode, target.id, collectionId ?? "");
}

function onToggle(sourceId: string, expanded: boolean) {
  settings.setExpanded(scope.value, sourceId, expanded);
}

function refreshAll() {
  void catalog.refetchDatabases();
  void catalog.refetchStoreInfo();
  void storeView.value?.refresh();
}

function isOurs(target: EventTarget | null): boolean {
  const element = root.value;
  if (!element) return false;
  if (!(target instanceof Node)) return true;
  return (
    element.contains(target) || target === document.body || target === document.documentElement
  );
}

useEventListener(document, "keydown", (event: KeyboardEvent) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
  if (event.key !== "f" && event.key !== "F") return;
  if (!location.store.value || !isOurs(event.target)) return;
  if (event.target instanceof Element && event.target.closest("[data-record-pane]")) return;
  event.preventDefault();
  storeView.value?.focusSearch();
});

useIdbCommands({
  hasStore: () => Boolean(location.store.value),
  canRefresh: () => location.mode.value === "live" && Boolean(catalog.targetId.value),
  refresh: refreshAll,
  focusSearch: () => storeView.value?.focusSearch(),
  openExport: () => void actions.openExport(),
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
          :loading="catalog.liveLoading.value"
          :error="catalog.liveError.value"
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
              {{
                catalog.targetId.value
                  ? "This page has no IndexedDB databases."
                  : "No export is open."
              }}
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
        <Button size="sm" variant="transparent" @click="location.replaceRoot('live')"
          >Back to IndexedDB</Button
        >
      </DataState>
      <DataState
        v-else-if="!catalog.openDatabase.value"
        kind="empty"
        title="Choose a database"
        text="Its stores, sizes and records open here. Pick a store to read and edit its records."
      />
      <IdbDatabaseView
        v-else-if="!location.store.value"
        :database="catalog.openDatabase.value"
        :stores="catalog.storeInfo.value"
        :loading="catalog.storeInfoLoading.value"
        :error="catalog.storeInfoError.value"
        :idb-usage="catalog.idbUsage.value"
        :read-at="null"
        :actions="openRow ? actionsFor(openRow) : []"
        @open="
          location.open(catalog.openDatabase.value.mode, catalog.openDatabase.value.id, $event)
        "
        @refresh="catalog.refetchStoreInfo()"
        @action="openRow && onTreeAction($event, openRow)"
      />
      <IdbStoreView
        v-else
        ref="storeView"
        :target-id="catalog.targetId.value"
        :database="catalog.openDatabase.value"
        :store="location.store.value"
        :info="catalog.openStoreInfo.value"
        :actions="openRow ? actionsFor(openRow) : []"
        :ask="confirm.ask"
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
