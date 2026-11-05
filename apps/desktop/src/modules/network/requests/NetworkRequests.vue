<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStorage } from "@vueuse/core";
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
import { requestsSummary } from "./requestFilters";
import { sortRequests, type RequestSort } from "./requestSort";
import { usePageReload } from "./usePageReload";
import { useRequestsCommands } from "./useRequestsCommands";
import { useRequestsKeyboard } from "./useRequestsKeyboard";
import { waterfallRange } from "./waterfall";

const store = useNetworkStore();
const presence = useTargetPresenceStore();
const route = useRoute();
const router = useRouter();
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
const menuEntry = shallowRef<NetworkEntry | null>(null);

const shown = computed(() => sortRequests(store.filteredEntries, sort.value));
const range = computed(() => waterfallRange(store.filteredEntries));
const selected = computed(() => store.selectedEntry);

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
  details: detailsPane,
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
  () => focusFilter(),
);

onMounted(() => {
  if (route.query.focus !== "filter") return;
  focusFilter();
  void router.replace({ query: { ...route.query, focus: undefined } });
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
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
            <div class="h-full" @contextmenu.capture="menuEntry = null">
              <RequestsTable
                ref="table"
                v-model:sort="sort"
                :entries="shown"
                :selected-id="store.selectedId"
                :range="range"
                @select="select"
                @clear="closeDetails"
                @menu="menuEntry = $event"
                @inspect="focusDetails"
              />
            </div>
          </ContextMenuTrigger>
          <RequestContextMenu
            v-if="menuEntry"
            :entry="menuEntry"
            :can-mock="actions.canMock"
            @copy="actions.copy(menuEntry, $event)"
            @mock="actions.mockResponse(menuEntry)"
          />
        </ContextMenu>
      </ResizablePanel>
      <template v-if="selected">
        <ResizableHandle />
        <ResizablePanel
          id="network-requests-details"
          :order="2"
          :default-size="42"
          :min-size="26"
          :max-size="70"
        >
          <div
            ref="detailsPane"
            class="h-full border-l border-border-subtle"
            @keydown.esc.stop="closeDetails"
          >
            <RequestDetails
              v-model:tab="tab"
              :entry="selected"
              :find-signal="findSignal"
              :bodies="bodies"
              :actions="actions"
              @close="closeDetails"
            />
          </div>
        </ResizablePanel>
      </template>
    </ResizablePanelGroup>
  </div>
</template>
