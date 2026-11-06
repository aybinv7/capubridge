<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { KeyRound, Globe } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import ConfirmDialog from "@/shared/components/presentation/ConfirmDialog.vue";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useTargetsStore } from "@/stores/targets.store";
import DataSourceTree from "@/modules/storage/frame/DataSourceTree.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import DataWorkbench from "@/modules/storage/frame/DataWorkbench.vue";
import { toggleRecordPane } from "@/modules/storage/frame/recordPaneOpen";
import { useDataConfirm } from "@/modules/storage/frame/useDataConfirm";
import { useDataPresence } from "@/modules/storage/frame/useDataPresence";
import { dataScope, useDataSidebarSettings } from "@/modules/storage/frame/useDataSidebarSettings";
import type { DataTreeRow } from "@/modules/storage/frame/dataFrame.types";
import { useStorageContextStore } from "@/modules/storage/stores/useStorageContextStore";
import { makeSource } from "./kvModel";
import { buildKvSections, resolveSource, selectionOf, sourceFromSelection } from "./kvSources";
import { kvTreeActions, runKvTreeAction } from "./kvTreeActions";
import KvCollection from "./KvCollection.vue";
import { useKvCommands } from "./useKvCommands";
import { useKvLocation } from "./useKvLocation";
import { useKvCatalog } from "./useKvQueries";

const location = useKvLocation();
const presence = useDataPresence();
const targets = useTargetsStore();
const settings = useDataSidebarSettings();
const context = useActiveContextStore();
const storageContext = useStorageContextStore();
const confirm = useDataConfirm();

const targetId = computed(() => targets.cdpTargetId);
const away = computed(() => presence.away.value);
const catalog = useKvCatalog(
  targetId,
  computed(() => away.value !== null),
);

const root = ref<HTMLElement | null>(null);
const collection = ref<InstanceType<typeof KvCollection> | null>(null);
const search = ref("");
const openCount = ref<number | null>(null);
const pendingAction = ref<"new-key" | null>(null);

const scope = computed(() =>
  dataScope(
    context.device?.serial ?? targetId.value,
    context.target?.packageName ?? "",
    "keyvalue",
  ),
);
const showHidden = computed({
  get: () => settings.showHidden(scope.value),
  set: (value: boolean) => settings.setShowHidden(scope.value, value),
});

const resolved = computed(() => resolveSource(location.query.value, catalog.discovery.value));
const open = computed(() => resolved.value.source);
const pageOrigin = computed(() => catalog.discovery.value?.pageOrigin ?? open.value?.origin ?? "");

watch(
  open,
  (source, previous) => {
    if (!source) return;
    if (catalog.discovery.value) location.settle(source);
    if (source.id === previous?.id) return;
    openCount.value = null;
    settings.setExpanded(scope.value, source.origin, true);
    if (targetId.value) storageContext.setSelectedOrigin(targetId.value, source.origin);
  },
  { immediate: true },
);

const sections = computed(() =>
  buildKvSections({
    discovery: catalog.discovery.value,
    settings: (sourceId) => settings.source(scope.value, sourceId),
    open: open.value,
    openCount: openCount.value,
  }),
);
const selection = computed(() => selectionOf(open.value));

function openList(origin: string, collectionId: string, then?: "refresh" | "new-key") {
  const next = sourceFromSelection(origin, collectionId);
  if (!next) return;
  if (next.id === open.value?.id) {
    if (then === "refresh") void collection.value?.refresh();
    else if (then === "new-key") void collection.value?.newKey();
    return;
  }
  pendingAction.value = then === "new-key" ? "new-key" : null;
  location.open(next);
}

watch(collection, async (mounted) => {
  if (!mounted || pendingAction.value !== "new-key") return;
  pendingAction.value = null;
  await nextTick();
  void mounted.newKey();
});

const treeContext = computed(() => ({
  scope: scope.value,
  settings,
  canWrite: away.value === null,
  openList,
}));

function actionsFor(row: DataTreeRow) {
  return kvTreeActions(row, treeContext.value);
}

function onTreeAction(actionId: string, row: DataTreeRow) {
  runKvTreeAction(actionId, row, treeContext.value);
}

function onSelect(sourceId: string, collectionId: string | null) {
  settings.setExpanded(scope.value, sourceId, true);
  openList(sourceId, collectionId ?? "local");
}

function onToggle(sourceId: string, expanded: boolean) {
  settings.setExpanded(scope.value, sourceId, expanded);
}

function backToPage() {
  if (!pageOrigin.value) return;
  location.open(makeSource({ kind: "local", origin: pageOrigin.value }));
}

function refreshAll() {
  void catalog.refetch();
  void collection.value?.refresh();
}

function findHere(): boolean {
  const element = root.value;
  const active = document.activeElement;
  if (!element) return false;
  if (!active || active === document.body || active === document.documentElement) return true;
  return element.contains(active) && !active.closest("[data-record-pane]");
}

useKvCommands({
  hasList: () => open.value !== null,
  canRead: () => Boolean(targetId.value) && away.value === null,
  canWrite: () => away.value === null,
  refresh: refreshAll,
  newKey: () => void collection.value?.newKey(),
  focusFind: () => collection.value?.focusFind(),
  findHere,
  togglePane: toggleRecordPane,
});
</script>

<template>
  <div ref="root" class="h-full min-h-0">
    <DataWorkbench kind="keyvalue">
      <template #sidebar>
        <DataSourceTree
          v-model:search="search"
          v-model:show-hidden="showHidden"
          :sections="sections"
          :selection="selection"
          :loading="catalog.loading.value && away === null"
          :error="away === null ? catalog.error.value : null"
          search-label="Find an origin or a list"
          :source-icon="Globe"
          :collection-icon="KeyRound"
          :actions-for="actionsFor"
          @select="onSelect"
          @toggle="onToggle"
          @action="onTreeAction"
          @retry="catalog.refetch()"
        >
          <template #empty>
            <p class="text-xs text-muted-foreground">This page has no origin to read.</p>
          </template>
        </DataSourceTree>
      </template>

      <DataState
        v-if="resolved.missing"
        kind="empty"
        title="This list is not on the page"
        :text="resolved.missing"
      >
        <Button size="sm" variant="transparent" @click="backToPage">
          Local storage of this page
        </Button>
      </DataState>
      <DataState v-else-if="!open && away" kind="waiting" title="Waiting for the app" :text="away">
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
        v-else-if="!open && catalog.error.value"
        kind="error"
        title="Could not read the page's key-value data"
        :detail="catalog.error.value"
        @retry="catalog.refetch()"
      />
      <DataState v-else-if="!open" kind="loading" title="Reading the page's key-value data" />
      <KvCollection
        v-else
        ref="collection"
        :key="open.id"
        :target-id="targetId"
        :source="open"
        :page-origin="pageOrigin"
        :away="away"
        :bringing="presence.bringing.value"
        :confirm="confirm.askAsync"
        @count="openCount = $event"
        @bring-to-front="presence.bringToFront()"
      />
    </DataWorkbench>

    <ConfirmDialog
      v-model:open="confirm.open.value"
      :request="confirm.request.value"
      @confirm="confirm.confirm()"
    />
  </div>
</template>
