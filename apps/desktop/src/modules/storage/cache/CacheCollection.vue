<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "@/lib/toast";
import { RefreshCw, Trash2 } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import DataCollectionHeader from "@/modules/storage/frame/DataCollectionHeader.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import { useWhenRead } from "@/modules/storage/frame/useWhenRead";
import CacheRows from "./CacheRows.vue";
import { hostOf } from "./cacheSources";
import { useCacheDomain, useCacheEntries } from "./useCacheQueries";
import { useCacheWrites } from "./useCacheWrites";

/**
 * One cache of the page: its header, then its entries. Mounted per cache, so its reads and
 * deletes can only ever reach that cache.
 */
const props = defineProps<{
  targetId: string;
  origin: string;
  cacheName: string;
  /** Why the phone cannot answer now (the app is away from the screen), or `null`. */
  away: string | null;
  bringing: boolean;
  confirm: (request: ConfirmRequest) => Promise<boolean>;
}>();

const emit = defineEmits<{
  count: [count: number | null];
  bringToFront: [];
  deleted: [];
  changed: [];
}>();

const rows = ref<InstanceType<typeof CacheRows> | null>(null);
const targetId = computed(() => props.targetId);
const away = computed(() => props.away);
const paused = computed(() => away.value !== null);
const read = useCacheEntries(
  targetId,
  computed(() => props.origin),
  computed(() => props.cacheName),
  paused,
);
const writes = useCacheWrites({
  origin: props.origin,
  cacheName: props.cacheName,
  domain: useCacheDomain(targetId),
  pending: read.pending,
  away,
  confirm: props.confirm,
  afterEntries: (removed, exact) => {
    if (exact) read.drop(removed);
    else void read.refetch();
    emit("changed");
  },
  afterCache: () => emit("deleted"),
});

watch(
  () => (read.pending.value ? null : read.total.value),
  (count) => emit("count", count),
  { immediate: true },
);

const whenRead = useWhenRead(read.pending, read.error, () =>
  toast.info("Nothing was deleted", {
    description: `The cache “${props.cacheName}” could not be read, so it was not deleted.`,
  }),
);

function deleteCache() {
  whenRead.run(() => {
    const total = read.total.value;
    void writes.confirmAndRemoveCache(
      total === null ? null : { count: total, fingerprint: read.fingerprint.value },
    );
  });
}

defineExpose({
  refresh: () => read.refetch(),
  focusFind: () => rows.value?.focusFind(),
  deleteCache,
});
</script>

<template>
  <DataCollectionHeader
    :title="cacheName"
    :identity="`Cache storage of ${hostOf(origin)}`"
    provenance="live"
    :read-at="read.readAt.value"
    :busy="read.fetching.value && !read.loading.value"
  >
    <template #actions>
      <IconAction
        :label="`Delete the cache “${cacheName}”…`"
        :hint="writes.blockedReason.value ?? 'Asks first, with what it holds'"
        :disabled="writes.blockedReason.value !== null || writes.busy.value"
        @click="deleteCache"
      >
        <Trash2 :stroke-width="1.8" />
      </IconAction>
      <IconAction
        label="Read again"
        hint="Reads this cache from the phone again"
        :disabled="away !== null"
        @click="read.refetch()"
      >
        <RefreshCw :stroke-width="1.8" />
      </IconAction>
    </template>
  </DataCollectionHeader>

  <DataState
    v-if="away && read.pending.value"
    kind="waiting"
    title="Waiting for the app"
    :text="away"
  >
    <Button
      size="sm"
      variant="solid-fill"
      color="brand"
      :loading="bringing"
      @click="emit('bringToFront')"
    >
      Bring to front
    </Button>
  </DataState>
  <DataState
    v-else-if="read.error.value && read.pending.value"
    kind="error"
    :title="`Could not read the cache “${cacheName}”`"
    :detail="read.error.value"
    @retry="read.refetch()"
  />
  <template v-else>
    <DataState
      v-if="read.error.value && !away"
      compact
      kind="error"
      title="Could not read this cache again; the entries below are from the last read"
      :detail="read.error.value"
      class="shrink-0 border-b border-border-subtle"
      @retry="read.refetch()"
    />
    <DataState
      v-if="away"
      compact
      kind="waiting"
      title="Waiting for the app; the entries below are from the last read"
      :text="away"
      class="shrink-0 border-b border-border-subtle"
    >
      <Button size="sm" variant="transparent" :loading="bringing" @click="emit('bringToFront')">
        Bring to front
      </Button>
    </DataState>
    <CacheRows
      ref="rows"
      :target-id="targetId"
      :origin="origin"
      :cache-name="cacheName"
      :rows="read.rows.value"
      :loading="read.loading.value"
      :total="read.total.value"
      :described="read.described.value"
      :paused="paused"
      :writes="writes"
      @read-list="read.refetch()"
    />
  </template>
</template>
