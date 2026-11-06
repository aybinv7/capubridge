<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Folder, HardDrive } from "lucide-vue-next";
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
import OpfsFolder from "./OpfsFolder.vue";
import { buildOpfsSections, parentOf, resolveFolder, selectionOf } from "./opfsSources";
import { opfsTreeActions, runOpfsTreeAction } from "./opfsTreeActions";
import { useOpfsCommands } from "./useOpfsCommands";
import { useOpfsLocation } from "./useOpfsLocation";
import { useOpfsFolders } from "./useOpfsQueries";

type PendingAction = "refresh" | "delete";

const location = useOpfsLocation();
const presence = useDataPresence();
const targets = useTargetsStore();
const settings = useDataSidebarSettings();
const context = useActiveContextStore();
const confirm = useDataConfirm();

const targetId = computed(() => targets.cdpTargetId);
const away = computed(() => presence.away.value);
const walk = useOpfsFolders(
  targetId,
  computed(() => away.value !== null),
);

const root = ref<HTMLElement | null>(null);
const folder = ref<InstanceType<typeof OpfsFolder> | null>(null);
const search = ref("");
const openCount = ref<number | null>(null);
const pendingAction = ref<PendingAction | null>(null);

const scope = computed(() =>
  dataScope(context.device?.serial ?? targetId.value, context.target?.packageName ?? "", "opfs"),
);
const showHidden = computed({
  get: () => settings.showHidden(scope.value),
  set: (value: boolean) => settings.setShowHidden(scope.value, value),
});

const origin = computed(() => walk.tree.value?.origin ?? "");
const available = computed(() => walk.tree.value?.available !== false);
const resolved = computed(() => resolveFolder(location.path.value, walk.tree.value));
const path = computed(() => resolved.value.path);

watch(path, () => (openCount.value = null));
watch(
  origin,
  (value) => {
    if (value) settings.setExpanded(scope.value, value, true);
  },
  { immediate: true },
);

const sections = computed(() =>
  buildOpfsSections({
    tree: walk.tree.value,
    settings: (sourceId) => settings.source(scope.value, sourceId),
    open: path.value,
    openCount: openCount.value,
    searching: search.value.trim() !== "",
  }),
);
const selection = computed(() => selectionOf(origin.value, path.value));

function openFolder(next: string, then?: PendingAction) {
  if (next === path.value) {
    if (then === "refresh") folder.value?.refresh();
    else if (then === "delete") folder.value?.deleteFolder();
    return;
  }
  pendingAction.value = then ?? null;
  location.open(next);
}

watch(folder, async (mounted) => {
  const action = pendingAction.value;
  if (!mounted || !action) return;
  pendingAction.value = null;
  await nextTick();
  if (action === "refresh") mounted.refresh();
  else mounted.deleteFolder();
});

function refreshAll() {
  void walk.refetch();
  folder.value?.refresh();
}

const treeContext = computed(() => ({
  scope: scope.value,
  settings,
  blockedReason: away.value,
  openFolder,
  refreshAll,
}));

function actionsFor(row: DataTreeRow) {
  return opfsTreeActions(row, treeContext.value);
}

function onTreeAction(actionId: string, row: DataTreeRow) {
  runOpfsTreeAction(actionId, row, treeContext.value);
}

function onSelect(_sourceId: string, collectionId: string | null) {
  location.open(collectionId ?? "");
}

function onToggle(sourceId: string, expanded: boolean) {
  settings.setExpanded(scope.value, sourceId, expanded);
}

function findHere(): boolean {
  const element = root.value;
  const active = document.activeElement;
  if (!element) return false;
  if (!active || active === document.body || active === document.documentElement) return true;
  return element.contains(active) && !active.closest("[data-record-pane]");
}

useOpfsCommands({
  inFolder: () => path.value !== "" && origin.value !== "",
  canRead: () => Boolean(targetId.value) && away.value === null,
  canWrite: () => away.value === null,
  refresh: refreshAll,
  focusFind: () => folder.value?.focusFind(),
  findHere,
  togglePane: toggleRecordPane,
  openParent: () => location.open(parentOf(path.value)),
  deleteFolder: () => folder.value?.deleteFolder(),
});
</script>

<template>
  <div ref="root" class="h-full min-h-0">
    <DataWorkbench kind="opfs">
      <template #sidebar>
        <DataSourceTree
          v-model:search="search"
          v-model:show-hidden="showHidden"
          :sections="sections"
          :selection="selection"
          :loading="walk.loading.value && away === null"
          :error="away === null ? walk.error.value : null"
          search-label="Find a folder"
          :source-icon="HardDrive"
          :collection-icon="Folder"
          :actions-for="actionsFor"
          @select="onSelect"
          @toggle="onToggle"
          @action="onTreeAction"
          @retry="walk.refetch()"
        >
          <template #empty>
            <p class="text-xs text-muted-foreground">This page has no OPFS to read.</p>
          </template>
        </DataSourceTree>
      </template>

      <DataState
        v-if="resolved.missing"
        kind="empty"
        title="This folder is not in OPFS"
        :text="resolved.missing"
      >
        <Button size="sm" variant="transparent" @click="location.open('')">
          Open the top of OPFS
        </Button>
      </DataState>
      <DataState
        v-else-if="walk.tree.value && !available"
        kind="empty"
        title="This page has no OPFS"
        :text="walk.tree.value.reason"
      />
      <OpfsFolder
        v-else-if="origin"
        ref="folder"
        :key="`${targetId}::${origin}::${path}`"
        :target-id="targetId"
        :origin="origin"
        :path="path"
        :away="away"
        :bringing="presence.bringing.value"
        :confirm="confirm.askAsync"
        @count="openCount = $event"
        @bring-to-front="presence.bringToFront()"
        @open-folder="openFolder"
        @changed="walk.refetch()"
      />
      <DataState v-else-if="away" kind="waiting" title="Waiting for the app" :text="away">
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
        v-else-if="walk.error.value"
        kind="error"
        title="Could not read the page's OPFS"
        :detail="walk.error.value"
        @retry="walk.refetch()"
      />
      <DataState v-else kind="loading" title="Reading the page's OPFS" />
    </DataWorkbench>

    <ConfirmDialog
      v-model:open="confirm.open.value"
      :request="confirm.request.value"
      @confirm="confirm.confirm()"
    />
  </div>
</template>
