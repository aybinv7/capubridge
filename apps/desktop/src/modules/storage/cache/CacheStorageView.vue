<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Archive, Globe } from "lucide-vue-next";
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
import CacheCollection from "./CacheCollection.vue";
import CacheOverview from "./CacheOverview.vue";
import { buildCacheSections, resolveCache, selectionOf } from "./cacheSources";
import { cacheTreeActions, runCacheTreeAction } from "./cacheTreeActions";
import { useCacheCommands } from "./useCacheCommands";
import { useCacheLocation } from "./useCacheLocation";
import { useCacheCatalog } from "./useCacheQueries";

type PendingAction = "refresh" | "delete";

const location = useCacheLocation();
const presence = useDataPresence();
const targets = useTargetsStore();
const settings = useDataSidebarSettings();
const context = useActiveContextStore();
const confirm = useDataConfirm();

const targetId = computed(() => targets.cdpTargetId);
const away = computed(() => presence.away.value);
const catalog = useCacheCatalog(
  targetId,
  computed(() => away.value !== null),
);

const root = ref<HTMLElement | null>(null);
const collection = ref<InstanceType<typeof CacheCollection> | null>(null);
const search = ref("");
const openCount = ref<number | null>(null);
const pendingAction = ref<PendingAction | null>(null);

const scope = computed(() =>
  dataScope(context.device?.serial ?? targetId.value, context.target?.packageName ?? "", "cache"),
);
const showHidden = computed({
  get: () => settings.showHidden(scope.value),
  set: (value: boolean) => settings.setShowHidden(scope.value, value),
});

const origin = computed(() => catalog.catalog.value?.origin ?? "");
const resolved = computed(() => resolveCache(location.cache.value, catalog.catalog.value));
const open = computed(() => resolved.value.cache);

watch(open, () => (openCount.value = null));

let landed = false;
watch(
  () => catalog.catalog.value,
  (value) => {
    if (landed || !value) return;
    landed = true;
    const only = value.caches.length === 1 ? value.caches[0] : undefined;
    if (only && !location.cache.value) location.replace(only.name);
  },
  { immediate: true },
);
watch(
  origin,
  (value) => {
    if (value) settings.setExpanded(scope.value, value, true);
  },
  { immediate: true },
);

const sections = computed(() =>
  buildCacheSections({
    catalog: catalog.catalog.value,
    settings: (sourceId) => settings.source(scope.value, sourceId),
    open: open.value,
    openCount: openCount.value,
  }),
);
const selection = computed(() => selectionOf(origin.value, open.value));

function openCache(name: string, then?: PendingAction) {
  if (name === open.value) {
    if (then === "refresh") void collection.value?.refresh();
    else if (then === "delete") collection.value?.deleteCache();
    return;
  }
  pendingAction.value = then ?? null;
  location.open(name);
}

watch(collection, async (mounted) => {
  const action = pendingAction.value;
  if (!mounted || !action) return;
  pendingAction.value = null;
  await nextTick();
  if (action === "refresh") void mounted.refresh();
  else mounted.deleteCache();
});

function refreshAll() {
  void catalog.refetch();
  void collection.value?.refresh();
}

const treeContext = computed(() => ({
  scope: scope.value,
  settings,
  blockedReason: away.value,
  openCache,
  refreshAll,
}));

function actionsFor(row: DataTreeRow) {
  return cacheTreeActions(row, treeContext.value);
}

function onTreeAction(actionId: string, row: DataTreeRow) {
  runCacheTreeAction(actionId, row, treeContext.value);
}

function onSelect(_sourceId: string, collectionId: string | null) {
  location.open(collectionId);
}

function onToggle(sourceId: string, expanded: boolean) {
  settings.setExpanded(scope.value, sourceId, expanded);
}

function onCacheDeleted() {
  location.open(null);
  void catalog.refetch();
}

function findHere(): boolean {
  const element = root.value;
  const active = document.activeElement;
  if (!element) return false;
  if (!active || active === document.body || active === document.documentElement) return true;
  return element.contains(active) && !active.closest("[data-record-pane]");
}

useCacheCommands({
  hasCache: () => open.value !== null,
  canRead: () => Boolean(targetId.value) && away.value === null,
  canWrite: () => away.value === null,
  refresh: refreshAll,
  focusFind: () => collection.value?.focusFind(),
  findHere,
  togglePane: toggleRecordPane,
  deleteCache: () => collection.value?.deleteCache(),
});
</script>

<template>
  <div ref="root" class="h-full min-h-0">
    <DataWorkbench kind="cache">
      <template #sidebar>
        <DataSourceTree
          v-model:search="search"
          v-model:show-hidden="showHidden"
          :sections="sections"
          :selection="selection"
          :loading="catalog.loading.value && away === null"
          :error="away === null ? catalog.error.value : null"
          search-label="Find a cache"
          :source-icon="Globe"
          :collection-icon="Archive"
          :actions-for="actionsFor"
          @select="onSelect"
          @toggle="onToggle"
          @action="onTreeAction"
          @retry="catalog.refetch()"
        >
          <template #empty>
            <p class="text-xs text-muted-foreground">This page has no Cache storage to read.</p>
          </template>
        </DataSourceTree>
      </template>

      <DataState
        v-if="resolved.missing"
        kind="empty"
        title="This cache is not on the page"
        :text="resolved.missing"
      >
        <Button size="sm" variant="transparent" @click="location.open(null)">
          All caches of this page
        </Button>
      </DataState>
      <CacheCollection
        v-else-if="open && origin"
        ref="collection"
        :key="`${origin}::${open}`"
        :target-id="targetId"
        :origin="origin"
        :cache-name="open"
        :away="away"
        :confirm="confirm.askAsync"
        @count="openCount = $event"
        @deleted="onCacheDeleted"
        @changed="catalog.refetch()"
      />
      <CacheOverview
        v-else-if="catalog.catalog.value"
        :catalog="catalog.catalog.value"
        :read-at="catalog.readAt.value"
        :busy="catalog.fetching.value && !catalog.loading.value"
        :away="away"
        @open="openCache"
        @refresh="catalog.refetch()"
      />
      <DataState v-else-if="away" kind="waiting" title="Waiting for the app" :text="away" />
      <DataState
        v-else-if="catalog.error.value"
        kind="error"
        title="Could not read the page's Cache storage"
        :detail="catalog.error.value"
        @retry="catalog.refetch()"
      />
      <DataState v-else kind="loading" title="Reading the page's Cache storage" />
    </DataWorkbench>

    <ConfirmDialog
      v-model:open="confirm.open.value"
      :request="confirm.request.value"
      @confirm="confirm.confirm()"
    />
  </div>
</template>
