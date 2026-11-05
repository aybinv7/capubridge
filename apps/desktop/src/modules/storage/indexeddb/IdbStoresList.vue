<script setup lang="ts">
import { computed, ref } from "vue";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import type { StoreInfo } from "@capubridge/cdp-protocol";
import { formatBytes } from "@/shared/format/numbers";
import { compareText } from "@/shared/format/collator";

type SortBy = "records" | "size" | "name";

/**
 * Every store of a database in one list: its key, whether keys are generated, its records with
 * a bar against the largest store, and its estimated size. Sorted by records, size or name;
 * a row opens the store.
 */
const props = defineProps<{ stores: readonly StoreInfo[] }>();

const emit = defineEmits<{ open: [store: string] }>();

const sortBy = ref<SortBy>("records");

const measure = (store: StoreInfo) =>
  sortBy.value === "size" ? store.estimatedSize : store.recordCount;

const rows = computed(() => {
  const list = [...props.stores];
  if (sortBy.value === "name") list.sort((left, right) => compareText(left.name, right.name));
  else list.sort((left, right) => measure(right) - measure(left));
  const max = Math.max(1, ...list.map(measure));
  return list.map((store) => ({
    store,
    share: sortBy.value === "name" ? 0 : measure(store) / max,
  }));
});

function keyText(store: StoreInfo): string {
  const path = store.keyPath;
  const key =
    path === null
      ? "keys kept apart"
      : `key ${Array.isArray(path) ? `[${path.join(", ")}]` : path}`;
  const generated =
    store.autoIncrement && store.keyGeneratorValue !== undefined
      ? ` · generated, next ${store.keyGeneratorValue}`
      : store.autoIncrement
        ? " · generated"
        : "";
  const indexes = store.indexCount
    ? ` · ${store.indexCount} ${store.indexCount === 1 ? "index" : "indexes"}`
    : "";
  return `${key}${generated}${indexes}`;
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex items-center gap-3">
      <h3 class="text-xs font-medium text-foreground">Stores</h3>
      <span class="flex-1" />
      <Segmented size="xs" active-variant="solid" aria-label="Sort the stores">
        <SegmentedButton :active="sortBy === 'records'" @click="sortBy = 'records'">
          Records
        </SegmentedButton>
        <SegmentedButton :active="sortBy === 'size'" @click="sortBy = 'size'">Size</SegmentedButton>
        <SegmentedButton :active="sortBy === 'name'" @click="sortBy = 'name'">Name</SegmentedButton>
      </Segmented>
    </div>
    <p v-if="rows.length === 0" class="text-xs text-muted-foreground">
      This database has no stores.
    </p>
    <ul v-else class="flex flex-col divide-y divide-border-subtle">
      <li v-for="{ store, share } in rows" :key="store.name">
        <button
          type="button"
          class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-control px-2 py-2 text-left hover:bg-cladd-surface-hover @2xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_7rem_6rem]"
          @click="emit('open', store.name)"
        >
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-xs text-foreground">{{ store.name }}</span>
            <span class="truncate font-mono text-2xs text-[var(--fg-subtle)]">
              {{ keyText(store) }}
            </span>
          </span>
          <span class="hidden h-1.5 overflow-hidden rounded-full bg-surface-cut @2xl:block">
            <span
              class="block h-full rounded-full bg-muted-foreground/50"
              :style="{ width: `${Math.max(share > 0 ? 2 : 0, share * 100)}%` }"
            />
          </span>
          <span class="text-right font-mono text-2xs text-muted-foreground tabular-nums">
            {{ store.recordCount.toLocaleString("en-US") }}
            {{ store.recordCount === 1 ? "record" : "records" }}
          </span>
          <span
            class="hidden text-right font-mono text-2xs text-[var(--fg-subtle)] tabular-nums @2xl:block"
          >
            {{ store.estimatedSize ? `≈ ${formatBytes(store.estimatedSize)}` : "" }}
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
