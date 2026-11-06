<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { Surface } from "@capubridge/cladd";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import type { NetworkEntry } from "@/types/network.types";
import { useNetworkStore } from "../stores/useNetworkStore";
import RequestContextMenu from "./RequestContextMenu.vue";
import RequestsEmpty from "./RequestsEmpty.vue";
import RequestsFilterBar from "./RequestsFilterBar.vue";
import RequestsTable from "./RequestsTable.vue";
import RequestsToolbar from "./RequestsToolbar.vue";
import { captureWord, emptyCopy, type EmptyAction } from "./captureState";
import RequestDetails from "./details/RequestDetails.vue";
import { asDetailTab, cycleTab, type DetailTab } from "./details/detailTabs";
import { useRequestActions } from "./details/useRequestActions";
import { useRequestBodies } from "./details/useRequestBodies";
import { columnVisibility } from "./requestColumns";
import { requestsSummary } from "./requestFilters";
import { sortRequests, type RequestSort } from "./requestSort";
import { usePageReload } from "./usePageReload";
import { useRequestsCommands } from "./useRequestsCommands";
import { useRequestsKeyboard } from "./useRequestsKeyboard";
import { waterfallRange } from "./waterfall";

const store = useNetworkStore();
const presence = useTargetPresenceStore();
const page = usePageReload();

const sort = shallowRef<RequestSort | null>(null);
const storedTab = useStorage<string>("capubridge:network:details-tab", "headers");
const tab = computed<DetailTab>({
  get: () => asDetailTab(storedTab.value),
  set: (value) => {
    storedTab.value = value;
  },
});
const findSignal = ref(0);
const toolbar = ref<InstanceType<typeof RequestsToolbar> | null>(null);
const table = ref<InstanceType<typeof RequestsTable> | null>(null);
const detailsPane = ref<HTMLElement | null>(null);
const root = ref<HTMLElement | null>(null);
const menuId = ref<string | null>(null);
const menuEntry = computed(() => store.entryById(menuId.value));

const shown = computed(() => sortRequests(store.filteredEntries, sort.value));
const selected = computed(() => store.selectedEntry);
const range = computed(() => (selected.value ? null : waterfallRange(store.filteredEntries)));
const visibility = computed(() =>
  columnVisibility({ waterfall: !selected.value, typeFilter: store.typeFilter }),
);
const revealKey = computed(
  () =>
    `${store.filterText}|${store.typeFilter}|${store.methodFilter}|${store.searchScope}|${store.revealSeq}`,
);

const captureInput = computed(() => ({
  status: store.captureStatus,
  recording: store.isRecording,
  presence: presence.presence,
  error: store.captureError,
}));
const word = computed(() => captureWord(captureInput.value));
const empty = computed(() =>
  emptyCopy({
    ...captureInput.value,
    captured: store.requestCount,
    filtering: store.hasActiveFilters,
  }),
);
const summary = computed(() =>
  requestsSummary({
    total: store.requestCount,
    shown: store.filteredEntries.length,
    transferred: store.transferredBytes,
    resources: store.resourceBytes,
    filtering: store.hasActiveFilters,
  }),
);

const bodies = useRequestBodies(selected, tab);
const actions = useRequestActions(bodies);

function select(entry: NetworkEntry) {
  store.select(entry.requestId);
}

function closeDetails() {
  store.select(null);
  void nextTick(() => table.value?.focus());
}

function focusFilter() {
  toolbar.value?.focusFilter();
}

function focusDetails() {
  detailsPane.value?.querySelector<HTMLElement>("[role='tab'][data-active], [role='tab']")?.focus();
}

async function runEmptyAction(action: Exclude<EmptyAction, null>) {
  if (action === "clear-filters") store.clearFilters();
  else if (action === "resume") store.isRecording = true;
  else await page.reload();
}

useRequestsKeyboard({
  root,
  details: detailsPane,
  detailsHasFind: () => tab.value === "response" || tab.value === "payload",
  hasSelection: () => selected.value !== null,
  focusFilter,
  findInDetails: () => {
    findSignal.value += 1;
  },
  move: (step) => table.value?.move(step),
  cycleTab: (step) => {
    tab.value = cycleTab(tab.value, step);
  },
});

useRequestsCommands({ selected, actions, reload: page.reload });

watch(
  () => store.focusSearchTrigger,
  () => {
    if (store.takeFilterFocus()) focusFilter();
  },
);

onMounted(() => {
  if (store.takeFilterFocus()) focusFilter();
});
</script>

<template>
  <div ref="root" class="flex h-full flex-col overflow-hidden">
    <RequestsToolbar
      ref="toolbar"
      :word="word"
      :reloading="page.reloading.value"
      :can-reload="page.canReload.value"
      @reload="page.reload()"
    />
    <RequestsFilterBar :summary="summary" />
    <ResizablePanelGroup
      direction="horizontal"
      auto-save-id="capubridge:network-requests"
      class="min-h-0 flex-1"
    >
      <ResizablePanel id="network-requests-list" :order="1" :min-size="30">
        <RequestsEmpty
          v-if="!shown.length"
          :copy="empty"
          :busy="page.reloading.value"
          @action="runEmptyAction"
        />
        <ContextMenu v-else>
          <ContextMenuTrigger as-child>
            <div class="h-full" @contextmenu.capture="menuId = null">
              <RequestsTable
                ref="table"
                v-model:sort="sort"
                :entries="shown"
                :selected-id="store.selectedId"
                :range="range"
                :visibility="visibility"
                :reveal-key="revealKey"
                @select="select"
                @clear="closeDetails"
                @menu="menuId = $event?.requestId ?? null"
                @inspect="focusDetails"
              />
            </div>
          </ContextMenuTrigger>
          <RequestContextMenu
            v-if="menuEntry"
            :entry="menuEntry"
            :can-mock="actions.canMock"
            @copy="menuEntry && actions.copy(menuEntry, $event)"
            @mock="menuEntry && actions.mockResponse(menuEntry)"
          />
        </ContextMenu>
      </ResizablePanel>
      <template v-if="selected">
        <ResizableHandle
          class="w-2 bg-transparent before:absolute before:inset-y-4 before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:transition-colors hover:bg-transparent hover:before:bg-border data-[state=drag]:before:bg-ring"
        />
        <ResizablePanel
          id="network-requests-details"
          :order="2"
          :default-size="42"
          :min-size="26"
          :max-size="70"
        >
          <div ref="detailsPane" class="h-full py-2 pr-2" @keydown.esc.stop="closeDetails">
            <Surface
              variant="solid"
              level="+1"
              outline
              class="h-full overflow-hidden rounded-well border border-border-subtle"
              content-class-name="flex min-h-0 flex-col"
            >
              <RequestDetails
                v-model:tab="tab"
                :entry="selected"
                :find-signal="findSignal"
                :bodies="bodies"
                :actions="actions"
                @close="closeDetails"
              />
            </Surface>
          </div>
        </ResizablePanel>
      </template>
    </ResizablePanelGroup>
  </div>
</template>
