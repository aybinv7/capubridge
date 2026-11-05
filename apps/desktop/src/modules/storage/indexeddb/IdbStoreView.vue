<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RefreshCw } from "lucide-vue-next";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import type { StoreInfo } from "@capubridge/cdp-protocol";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import ChangeSummary from "@/modules/storage/frame/ChangeSummary.vue";
import DataCollectionHeader from "@/modules/storage/frame/DataCollectionHeader.vue";
import DataRowMenu from "@/modules/storage/frame/DataRowMenu.vue";
import type { DataAction } from "@/modules/storage/frame/dataFrame.types";
import { useIndexedDBTableChangeOverlay } from "@/modules/storage/changes/useIndexedDBChangeOverlay";
import type { IndexedDBDecoratedRecord } from "@/modules/storage/changes/useIndexedDBChangeOverlay";
import IdbRows from "./IdbRows.vue";
import IdbStructure from "./IdbStructure.vue";
import { keyLabelOf } from "./idbGridModel";
import { useIdbPage } from "./useIdbPage";
import { useIdbStoreWrites } from "./useIdbStoreWrites";
import type { IdbOpenDatabase } from "./useIdbCatalog";

/** One store: its header, then its rows (with the record pane) or its structure. */
const props = defineProps<{
  targetId: string;
  database: IdbOpenDatabase;
  store: string;
  info: StoreInfo | undefined;
  actions: readonly DataAction[];
  ask: (request: ConfirmRequest, run: () => Promise<void> | void) => void;
}>();

const emit = defineEmits<{ action: [id: string]; afterWrite: [] }>();

const view = ref<"rows" | "structure">("rows");
const changesOnly = ref(false);
const rows = ref<InstanceType<typeof IdbRows> | null>(null);

const open = computed(() => props.database);
const storeName = computed(() => props.store);
const pager = useIdbPage({ targetId: computed(() => props.targetId), open, store: storeName });

const writes = useIdbStoreWrites({
  open,
  store: storeName,
  domain: pager.domain,
  afterWrite: () => {
    void pager.refetch();
    emit("afterWrite");
  },
});

const overlayOrigin = computed(() => (props.database.mode === "live" ? props.database.origin : ""));
const { recordsWithChanges, storeSummary } = useIndexedDBTableChangeOverlay(
  pager.records,
  overlayOrigin,
  computed(() => props.database.name),
  storeName,
);
const records = computed<IndexedDBDecoratedRecord[]>(() =>
  props.database.mode === "live" && !pager.storeSearch.value
    ? recordsWithChanges.value
    : pager.records.value,
);

watch([() => props.database.id, storeName], () => {
  changesOnly.value = false;
  view.value = "rows";
});
watch(
  () => storeSummary.value.total,
  (total) => {
    if (total === 0) changesOnly.value = false;
  },
);

const keyPath = computed(() => {
  const path = props.info?.keyPath;
  if (path === undefined) return "";
  if (path === null) return "keys apart from values";
  return `key ${Array.isArray(path) ? `[${path.join(", ")}]` : path}`;
});

function deleteRecords(list: IndexedDBDecoratedRecord[], afterDelete: () => void) {
  const single = list.length === 1 ? list[0] : undefined;
  props.ask(
    {
      title: single ? "Delete this record?" : `Delete ${list.length} records?`,
      text: single
        ? `The record ${keyLabelOf(single)} is deleted from "${props.store}" on the phone. This cannot be undone.`
        : `${list.length} records are deleted from "${props.store}" on the phone. This cannot be undone.`,
      confirmLabel: single ? "Delete record" : `Delete ${list.length} records`,
      danger: true,
    },
    async () => {
      await writes.removeRecords(list);
      afterDelete();
    },
  );
}

defineExpose({
  focusSearch: () => {
    view.value = "rows";
    rows.value?.focusSearch();
  },
  refresh: () => pager.refetch(),
});
</script>

<template>
  <DataCollectionHeader
    :title="store"
    :identity="`in ${database.name}${keyPath ? ` · ${keyPath}` : ''}`"
    :provenance="database.mode === 'live' ? 'live' : 'imported'"
    :read-at="pager.readAt.value"
    :busy="pager.fetching.value && !pager.loading.value"
  >
    <ChangeSummary v-model:changes-only="changesOnly" :changes="storeSummary" />
    <template #actions>
      <Segmented size="xs" active-variant="solid" aria-label="What to show of the store">
        <SegmentedButton :active="view === 'rows'" @click="view = 'rows'">Rows</SegmentedButton>
        <SegmentedButton :active="view === 'structure'" @click="view = 'structure'">
          Structure
        </SegmentedButton>
      </Segmented>
      <IconAction
        v-if="database.mode === 'live'"
        label="Read again"
        hint="Reads this page from the phone again"
        @click="pager.refetch()"
      >
        <RefreshCw :stroke-width="1.8" />
      </IconAction>
      <DataRowMenu
        v-if="actions.length"
        :actions="actions"
        :label="`Actions for ${store}`"
        @select="emit('action', $event)"
      />
    </template>
  </DataCollectionHeader>

  <IdbRows
    v-if="view === 'rows'"
    ref="rows"
    :database="database.name"
    :store="store"
    :store-info="info"
    :records="records"
    :pager="pager"
    :writes="writes"
    :changes-only="changesOnly"
    :layout-key="`idb:${database.mode === 'live' ? database.origin : 'file'}:${database.name}/${store}`"
    @delete-records="deleteRecords"
  />
  <IdbStructure v-else :info="info" />
</template>
