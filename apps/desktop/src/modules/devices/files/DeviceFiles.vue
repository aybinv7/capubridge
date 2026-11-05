<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useId, watch } from "vue";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import DetailsPane from "../shared/DetailsPane.vue";
import DeviceConfirmDialog from "../shared/DeviceConfirmDialog.vue";
import { optionId } from "@/shared/list/rowState";
import FileDetails from "./FileDetails.vue";
import FileMenu from "./FileMenu.vue";
import FilesGrid from "./FilesGrid.vue";
import FilesList from "./FilesList.vue";
import FilesListHeader from "./FilesListHeader.vue";
import FilesSidebar from "./FilesSidebar.vue";
import FilesState from "./FilesState.vue";
import FilesToolbar from "./FilesToolbar.vue";
import { isFolderEntry, type DeviceFileListEntry } from "./filePaths";
import { useFileActions } from "./useFileActions";
import { useFileBrowser } from "./useFileBrowser";
import { useFileViewer } from "./useFileViewer";
import { useFilesCommands } from "./useFilesCommands";
import { useFilesKeyboard } from "./useFilesKeyboard";
import FileViewerDialog from "./viewer/FileViewerDialog.vue";

const browser = useFileBrowser();
const viewer = useFileViewer(browser.serial, browser.entries);
const actions = useFileActions(browser.serial, {
  beforeDelete: browser.rememberNeighbour,
  afterDelete: () => browser.refresh(),
});

const listPane = ref<HTMLElement | null>(null);
const listView = ref<InstanceType<typeof FilesList> | InstanceType<typeof FilesGrid> | null>(null);
const menuEntry = shallowRef<DeviceFileListEntry | null>(null);
const searchFocused = ref(false);
const listId = useId();

const sizesKnown = computed(() => browser.scope.value === "folder");
const showEntries = computed(
  () =>
    !browser.loading.value &&
    !browser.errorText.value &&
    !browser.needsQuery.value &&
    browser.entries.value.length > 0,
);

const activeId = computed(() => {
  const path = browser.selectedPath.value;
  if (!path || !showEntries.value || !listView.value?.isRendered(path)) return undefined;
  return optionId(listId, path);
});

function open(entry: DeviceFileListEntry) {
  if (isFolderEntry(entry)) browser.openFolder(entry.path);
  else void viewer.show(entry);
}

function showDetails(entry: DeviceFileListEntry) {
  browser.select(entry);
  browser.detailsOpen.value = true;
}

function onMenu(entry: DeviceFileListEntry) {
  browser.select(entry);
  menuEntry.value = entry;
}

const { onKeydown } = useFilesKeyboard({
  browser,
  open,
  showDetails,
  requestDelete: actions.requestDelete,
  columns: () => listView.value?.columns() ?? 1,
  reveal: (index) => listView.value?.reveal(index),
});

useFilesCommands({ browser });

watch(browser.dir, () => {
  viewer.close();
  void nextTick(() => listPane.value?.focus());
});
watch(browser.entries, () => {
  if (!searchFocused.value) void nextTick(() => listPane.value?.focus({ preventScroll: true }));
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <FilesToolbar
      v-model:query="browser.query.value"
      v-model:scope="browser.scope.value"
      v-model:view="browser.view.value"
      v-model:show-hidden="browser.showHidden.value"
      v-model:details-open="browser.detailsOpen.value"
      v-model:refresh-every-ms="browser.refreshEveryMs.value"
      :dir="browser.dir.value"
      :loading="browser.loading.value"
      @open="browser.openFolder"
      @up="browser.openParent()"
      @refresh="void browser.refresh()"
      @search-focus="searchFocused = $event"
    />

    <ResizablePanelGroup direction="horizontal" class="min-h-0 flex-1">
      <ResizablePanel
        :default-size="20"
        :min-size="12"
        :max-size="35"
        class="border-r border-border-subtle"
      >
        <FilesSidebar
          :rows="browser.tree.rows.value"
          :dir="browser.dir.value"
          @open="browser.openFolder"
          @toggle="void browser.tree.toggle($event)"
        />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel :default-size="80" class="min-h-0">
        <div class="flex h-full min-h-0">
          <div class="flex min-w-0 flex-1 flex-col">
            <FilesListHeader
              v-if="showEntries && browser.view.value === 'list'"
              v-model:sort="browser.sort.value"
            />
            <ContextMenu>
              <ContextMenuTrigger as-child>
                <div
                  ref="listPane"
                  class="min-h-0 flex-1 outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
                  tabindex="0"
                  :role="showEntries ? 'listbox' : undefined"
                  :aria-label="
                    browser.scope.value === 'device' ? 'Search results' : 'Folder contents'
                  "
                  :aria-activedescendant="activeId"
                  @keydown="onKeydown"
                  @contextmenu.capture="menuEntry = null"
                >
                  <template v-if="showEntries">
                    <FilesList
                      v-if="browser.view.value === 'list'"
                      ref="listView"
                      :list-id="listId"
                      :entries="browser.entries.value"
                      :selected="browser.selectedPath.value"
                      :sizes-known="sizesKnown"
                      @select="browser.select"
                      @open="open"
                      @menu="onMenu"
                      @download="actions.download"
                      @delete="actions.requestDelete"
                    />
                    <FilesGrid
                      v-else
                      ref="listView"
                      :list-id="listId"
                      :entries="browser.entries.value"
                      :selected="browser.selectedPath.value"
                      @select="browser.select"
                      @open="open"
                      @menu="onMenu"
                    />
                  </template>
                  <FilesState
                    v-else
                    :loading="browser.loading.value"
                    :error="browser.errorText.value"
                    :needs-query="browser.needsQuery.value"
                    :scope="browser.scope.value"
                    :filtered="browser.query.value.trim() !== ''"
                  />
                </div>
              </ContextMenuTrigger>
              <FileMenu
                v-if="menuEntry"
                :entry="menuEntry"
                @open="open(menuEntry)"
                @details="showDetails(menuEntry)"
                @open-on-computer="actions.openOnComputer(menuEntry)"
                @download="actions.download(menuEntry)"
                @delete="actions.requestDelete(menuEntry)"
              />
            </ContextMenu>
          </div>
          <DetailsPane
            :open="browser.detailsOpen.value"
            title="Details"
            :label="
              browser.selected.value ? `Details of ${browser.selected.value.name}` : 'Details'
            "
            @close="browser.detailsOpen.value = false"
          >
            <FileDetails
              :entry="browser.selected.value"
              :sizes-known="sizesKnown"
              @open="browser.selected.value && open(browser.selected.value)"
              @open-on-computer="
                browser.selected.value && actions.openOnComputer(browser.selected.value)
              "
              @download="browser.selected.value && actions.download(browser.selected.value)"
              @delete="browser.selected.value && actions.requestDelete(browser.selected.value)"
            />
          </DetailsPane>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>

    <FileViewerDialog
      v-model:open="viewer.open.value"
      :entry="viewer.entry.value"
      :state="viewer.state.value"
      :position="viewer.position.value"
      :database-route="viewer.databaseRoute.value"
      @step="viewer.step"
      @retry="viewer.retry"
      @open-on-computer="actions.openOnComputer"
      @choose-app="actions.chooseApp"
      @download="actions.download"
    />
    <DeviceConfirmDialog
      v-model:open="actions.deleteOpen.value"
      :request="actions.deleteRequest.value"
      @confirm="actions.confirmDelete()"
    />
  </div>
</template>
