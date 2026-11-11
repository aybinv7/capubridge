<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { Plus, RefreshCw } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import DataCollectionHeader from "@/modules/storage/frame/DataCollectionHeader.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import type { KvSource } from "./kvModel";
import { sourceLabel } from "./kvSources";
import KvRows from "./KvRows.vue";
import { useKvDomain, useKvEntries } from "./useKvQueries";
import { useKvWrites } from "./useKvWrites";

/**
 * One list (Local storage, Session storage or a LocalForage store) of one origin: its header,
 * then its keys. Mounted per list, so its reads and writes can only ever reach that list.
 */
const props = defineProps<{
  targetId: string;
  source: KvSource;
  pageOrigin: string;
  /** Why the phone cannot answer now (the app is away from the screen), or `null`. */
  away: string | null;
  confirm: (request: ConfirmRequest) => Promise<boolean>;
}>();

const emit = defineEmits<{ count: [count: number | null] }>();

const rows = ref<InstanceType<typeof KvRows> | null>(null);
const targetId = computed(() => props.targetId);
const source = computed(() => props.source);
const away = computed(() => props.away);
const read = useKvEntries(
  targetId,
  source,
  computed(() => away.value !== null),
);
const writes = useKvWrites({
  source: props.source,
  domain: useKvDomain(targetId),
  pending: read.pending,
  away,
  confirm: props.confirm,
  afterWrite: (change) => read.apply(change),
});

watch(
  () => (read.pending.value ? null : read.total.value),
  (count) => emit("count", count),
  { immediate: true },
);

const title = computed(() => sourceLabel(props.source));
const identity = computed(() => {
  if (props.source.kind === "forage") {
    return `IndexedDB ${props.source.database} › ${props.source.store}`;
  }
  return props.source.origin === props.pageOrigin
    ? props.source.origin
    : `frame ${props.source.origin}`;
});

async function guardUnsaved(): Promise<boolean> {
  return rows.value ? rows.value.guardDiscard() : true;
}

onBeforeRouteUpdate(guardUnsaved);
onBeforeRouteLeave(guardUnsaved);

defineExpose({
  refresh: () => read.refetch(),
  newKey: () => rows.value?.startCreate(),
  focusFind: () => rows.value?.focusFind(),
  guardUnsaved,
});
</script>

<template>
  <DataCollectionHeader
    :title="title"
    :identity="identity"
    provenance="live"
    :read-at="read.readAt.value"
    :busy="read.fetching.value && !read.loading.value"
  >
    <template #actions>
      <Button
        size="sm"
        variant="transparent"
        content-class-name="gap-1.5"
        :disabled="writes.blockedReason.value !== null"
        @click="rows?.startCreate()"
      >
        <Plus :size="12" aria-hidden="true" />
        New key
      </Button>
      <IconAction
        label="Read again"
        hint="Reads this list from the phone again"
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
  />
  <DataState
    v-else-if="read.error.value && read.pending.value"
    kind="error"
    :title="`Could not read ${title}`"
    :detail="read.error.value"
    @retry="read.refetch()"
  />
  <template v-else>
    <DataState
      v-if="read.error.value && !away"
      compact
      kind="error"
      title="Could not read this list again; the keys below are from the last read"
      :detail="read.error.value"
      class="shrink-0 border-b border-border-subtle"
      @retry="read.refetch()"
    />
    <DataState
      v-if="away"
      compact
      kind="waiting"
      title="Waiting for the app; the keys below are from the last read"
      :text="away"
      class="shrink-0 border-b border-border-subtle"
    />
    <KvRows
      ref="rows"
      :source="source"
      :entries="read.entries.value"
      :loading="read.loading.value"
      :more="read.more.value"
      :total="read.total.value"
      :writes="writes"
      :confirm="confirm"
    />
  </template>
</template>
