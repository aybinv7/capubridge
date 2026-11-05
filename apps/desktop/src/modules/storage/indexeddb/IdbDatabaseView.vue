<script setup lang="ts">
import { computed } from "vue";
import { RefreshCw } from "lucide-vue-next";
import type { StoreInfo } from "@capubridge/cdp-protocol";
import { formatBytes } from "@/shared/format/numbers";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import DataCollectionHeader from "@/modules/storage/frame/DataCollectionHeader.vue";
import DataOverview from "@/modules/storage/frame/DataOverview.vue";
import DataRowMenu from "@/modules/storage/frame/DataRowMenu.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import type { DataAction } from "@/modules/storage/frame/dataFrame.types";
import type { IdbOpenDatabase } from "./useIdbCatalog";

/** A database at a glance: size, stores, records, the largest stores and every store's shape. */
const props = defineProps<{
  database: IdbOpenDatabase;
  stores: readonly StoreInfo[] | undefined;
  loading: boolean;
  error: string | null;
  idbUsage: number | null;
  readAt: number | null;
  actions: readonly DataAction[];
}>();

const emit = defineEmits<{ open: [store: string]; refresh: []; action: [id: string] }>();

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

const bars = computed(() => {
  const top = (measure: (store: StoreInfo) => number, show: (store: StoreInfo) => string) =>
    [...list.value]
      .filter((store) => measure(store) > 0)
      .sort((left, right) => measure(right) - measure(left))
      .slice(0, 10)
      .map((store) => ({
        id: store.name,
        label: store.name,
        value: measure(store),
        display: show(store),
      }));
  return [
    {
      id: "records",
      title: "Most records",
      items: top(
        (store) => store.recordCount,
        (store) => store.recordCount.toLocaleString("en-US"),
      ),
      empty: "Every store is empty.",
    },
    {
      id: "size",
      title: "Largest, estimated",
      items: top(
        (store) => store.estimatedSize,
        (store) => formatBytes(store.estimatedSize),
      ),
      empty: "No size measured yet.",
    },
  ];
});

function keyPathText(keyPath: StoreInfo["keyPath"]): string {
  if (keyPath === null) return "out-of-line";
  return Array.isArray(keyPath) ? `[${keyPath.join(", ")}]` : keyPath;
}
</script>

<template>
  <DataCollectionHeader
    :title="database.name"
    :identity="
      database.mode === 'live'
        ? `${database.origin} · version ${database.version}`
        : `version ${database.version} · from a file`
    "
    :provenance="database.mode === 'live' ? 'live' : 'imported'"
    :read-at="readAt"
    :busy="loading && stores !== undefined"
  >
    <template #actions>
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
  <DataOverview v-else :stats="stats" :bars="bars" @open="emit('open', $event)">
    <section class="flex flex-col gap-2">
      <h3 class="text-xs font-medium text-foreground">Stores</h3>
      <p v-if="list.length === 0" class="text-xs text-muted-foreground">
        This database has no stores.
      </p>
      <ul v-else class="flex flex-col divide-y divide-border-subtle">
        <li v-for="store in list" :key="store.name">
          <button
            type="button"
            class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 rounded-control px-2 py-2 text-left hover:bg-cladd-surface-hover @2xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_7rem_6rem]"
            @click="emit('open', store.name)"
          >
            <span class="truncate text-xs text-foreground">{{ store.name }}</span>
            <span class="hidden truncate font-mono text-2xs text-[var(--fg-subtle)] @2xl:block">
              key {{ keyPathText(store.keyPath)
              }}{{ store.autoIncrement ? " · auto-increment" : "" }}
              {{
                store.indexCount
                  ? ` · ${store.indexCount} index${store.indexCount > 1 ? "es" : ""}`
                  : ""
              }}
            </span>
            <span class="text-right font-mono text-2xs text-muted-foreground tabular-nums">
              {{ store.recordCount.toLocaleString("en-US") }} records
            </span>
            <span
              class="hidden text-right font-mono text-2xs text-[var(--fg-subtle)] tabular-nums @2xl:block"
            >
              {{
                store.keyGeneratorValue !== undefined && store.autoIncrement
                  ? `next ${store.keyGeneratorValue}`
                  : ""
              }}
            </span>
          </button>
        </li>
      </ul>
    </section>
  </DataOverview>
</template>
