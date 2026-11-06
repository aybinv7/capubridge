<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { RefreshCw } from "lucide-vue-next";
import type { StoreInfo } from "@capubridge/cdp-protocol";
import { formatBytes } from "@/shared/format/numbers";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { IdbDiagramSubject } from "@/modules/storage/diagram/diagramSubject";
import DataCollectionHeader from "@/modules/storage/frame/DataCollectionHeader.vue";
import DataOverview from "@/modules/storage/frame/DataOverview.vue";
import DataRowMenu from "@/modules/storage/frame/DataRowMenu.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import type { DataAction } from "@/modules/storage/frame/dataFrame.types";
import IdbStoresList from "./IdbStoresList.vue";
import type { IdbOpenDatabase } from "./useIdbCatalog";
import type { IdbDatabaseView } from "./useIdbLocation";

const DiagramView = defineAsyncComponent(() => import("@/modules/storage/diagram/DiagramView.vue"));

/**
 * A database at a glance (size, stores, records, the largest stores and every store's shape),
 * or as a diagram of its stores.
 */
const props = defineProps<{
  database: IdbOpenDatabase;
  stores: readonly StoreInfo[] | undefined;
  loading: boolean;
  error: string | null;
  idbUsage: number | null;
  readAt: number | null;
  actions: readonly DataAction[];
  view: IdbDatabaseView;
  targetId: string;
  /** The phone and app the page belongs to. */
  owner: { serial: string; packageName: string };
  /** The address of one of its stores, for the diagram's "Open data". */
  storePath: (store: string) => string;
}>();

const emit = defineEmits<{
  open: [store: string];
  refresh: [];
  action: [id: string];
  setView: [view: IdbDatabaseView];
}>();

const diagram = computed<IdbDiagramSubject | null>(() => {
  if (!props.stores) return null;
  const { database } = props;
  const file = database.mode === "file";
  return {
    kind: "indexeddb",
    place: {
      serial: file ? "" : props.owner.serial,
      packageName: file ? "file" : props.owner.packageName,
      kind: "indexeddb",
      databasePath: file ? `file:${database.name}` : `${database.origin}/${database.name}`,
    },
    database,
    stores: props.stores,
    targetId: props.targetId,
    openStore: props.storePath,
  };
});

const list = computed(() => props.stores ?? []);
const records = computed(() => list.value.reduce((sum, store) => sum + store.recordCount, 0));
const estimated = computed(() => list.value.reduce((sum, store) => sum + store.estimatedSize, 0));
const indexes = computed(() => list.value.reduce((sum, store) => sum + store.indexCount, 0));

const stats = computed(() => [
  { label: "Stores", value: String(props.database.storeNames.length) },
  { label: "Records", value: records.value.toLocaleString("en-US") },
  { label: "Indexes", value: String(indexes.value) },
  {
    label: "Size, estimated",
    value: formatBytes(estimated.value),
    detail:
      props.database.mode === "live" && props.idbUsage !== null
        ? `of ${formatBytes(props.idbUsage)} used by IndexedDB`
        : undefined,
  },
]);
</script>

<template>
  <DataCollectionHeader
    :title="database.name"
    :identity="
      database.mode === 'live'
        ? `${database.origin} · version ${database.version}`
        : `version ${database.version}`
    "
    :provenance="database.mode === 'live' ? 'live' : 'imported'"
    :read-at="readAt"
    :busy="loading && stores !== undefined"
  >
    <template #actions>
      <Segmented size="xs" active-variant="solid" aria-label="What to show of the database">
        <SegmentedButton :active="view === 'overview'" @click="emit('setView', 'overview')">
          Overview
        </SegmentedButton>
        <SegmentedButton :active="view === 'diagram'" @click="emit('setView', 'diagram')">
          Diagram
        </SegmentedButton>
      </Segmented>
      <IconAction v-if="database.mode === 'live'" label="Read again" @click="emit('refresh')">
        <RefreshCw :stroke-width="1.8" />
      </IconAction>
      <DataRowMenu
        v-if="actions.length"
        :actions="actions"
        :label="`Actions for ${database.name}`"
        @select="emit('action', $event)"
      />
    </template>
  </DataCollectionHeader>

  <DataState v-if="loading && !stores" kind="loading" title="Reading the stores" />
  <DataState
    v-else-if="error && !stores"
    kind="error"
    title="Could not read this database"
    :detail="error"
    @retry="emit('refresh')"
  />
  <template v-else>
    <DataState
      v-if="error"
      compact
      kind="error"
      title="Could not read the stores again; this is the last read"
      :detail="error"
      class="shrink-0 border-b border-border-subtle"
      @retry="emit('refresh')"
    />
    <DiagramView v-if="view === 'diagram' && diagram" :subject="diagram" />
    <DataOverview v-else :stats="stats" :bars="[]" @open="emit('open', $event)">
      <IdbStoresList :stores="list" @open="emit('open', $event)" />
    </DataOverview>
  </template>
</template>
