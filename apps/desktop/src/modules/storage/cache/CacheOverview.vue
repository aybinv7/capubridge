<script setup lang="ts">
import { computed } from "vue";
import { RefreshCw } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import type { CacheStorageCatalog } from "@capubridge/cdp-protocol";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import DataCollectionHeader from "@/modules/storage/frame/DataCollectionHeader.vue";
import DataOverview, { type OverviewBars } from "@/modules/storage/frame/DataOverview.vue";
import DataState from "@/modules/storage/frame/DataState.vue";
import { hostOf } from "./cacheSources";

/** The page's Cache storage at a glance: how many caches and entries, the fullest caches. */
const props = defineProps<{
  catalog: CacheStorageCatalog;
  readAt: number | null;
  busy: boolean;
  away: string | null;
  bringing: boolean;
}>();

const emit = defineEmits<{ open: [name: string]; refresh: []; bringToFront: [] }>();

const entries = computed(() =>
  props.catalog.caches.reduce((sum, cache) => sum + (cache.count ?? 0), 0),
);
const stats = computed(() => [
  { label: "Caches", value: props.catalog.caches.length.toLocaleString("en-US") },
  { label: "Entries", value: entries.value.toLocaleString("en-US") },
]);
const bars = computed<OverviewBars[]>(() => [
  {
    id: "entries",
    title: "Most entries",
    empty: "Every cache is empty.",
    items: [...props.catalog.caches]
      .filter((cache) => (cache.count ?? 0) > 0)
      .sort((left, right) => (right.count ?? 0) - (left.count ?? 0))
      .slice(0, 8)
      .map((cache) => ({
        id: cache.name,
        label: cache.name,
        value: cache.count ?? 0,
        display: (cache.count ?? 0).toLocaleString("en-US"),
      })),
  },
]);
</script>

<template>
  <DataCollectionHeader
    title="Cache storage"
    :identity="hostOf(catalog.origin)"
    provenance="live"
    :read-at="readAt"
    :busy="busy"
  >
    <template #actions>
      <IconAction
        label="Read again"
        hint="Reads the page's caches from the phone again"
        :disabled="away !== null"
        @click="emit('refresh')"
      >
        <RefreshCw :stroke-width="1.8" />
      </IconAction>
    </template>
  </DataCollectionHeader>
  <DataState
    v-if="away"
    compact
    kind="waiting"
    title="Waiting for the app; the caches below are from the last read"
    :text="away"
    class="shrink-0 border-b border-border-subtle"
  >
    <Button size="sm" variant="transparent" :loading="bringing" @click="emit('bringToFront')">
      Bring to front
    </Button>
  </DataState>
  <DataState
    v-if="!catalog.available"
    kind="empty"
    title="This page has no Cache storage"
    text="The Cache API only exists on a secure page (https, or localhost). Capacitor apps serve from https://localhost by default; a plain http page cannot use it."
  />
  <DataState
    v-else-if="catalog.caches.length === 0"
    kind="empty"
    title="The app has saved no responses here"
    text="Cache storage fills when a service worker (Workbox, Angular, an Ionic PWA) or the app's own code calls caches.open(). Apps without one keep it empty."
  />
  <DataOverview v-else :stats="stats" :bars="bars" @open="emit('open', $event)">
    <p class="max-w-xl text-xs text-muted-foreground">
      Cache storage holds whole responses (status, headers and body) that the app saved with the
      Cache API, usually from its service worker, to answer requests offline. Entries stay until the
      app deletes them; HTTP expiry headers do not remove them. Pick a cache to read its entries.
    </p>
  </DataOverview>
</template>
