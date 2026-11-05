<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, ListFilter, ScanSearch, Trash2 } from "lucide-vue-next";
import { Button, SearchField } from "@capubridge/cladd";
import { DataGridColumnsMenu, type GridColumn } from "@/shared/components/data/grid";
import DataFilterPopover from "@/shared/components/data/filter/DataFilterPopover.vue";
import type { DataPredicate, PredicateJoin } from "@/shared/components/data/filter/predicates";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import DataRowMenu from "@/modules/storage/frame/DataRowMenu.vue";
import type { DataAction } from "@/modules/storage/frame/dataFrame.types";

/**
 * Above the rows: find on this page, search the whole store on the phone, filter, columns,
 * export and the delete of selected rows.
 */
const props = defineProps<{
  columns: readonly GridColumn[];
  predicates: readonly DataPredicate[];
  join: PredicateJoin;
  selectedCount: number;
  canDelete: boolean;
  storeSearching: boolean;
  inStoreSearch: boolean;
  filterSeed?: string | null;
}>();

const search = defineModel<string>("search", { required: true });
const visibility = defineModel<Record<string, boolean>>("visibility", { required: true });
const filterOpen = defineModel<boolean>("filterOpen", { required: true });

const emit = defineEmits<{
  searchStore: [];
  filter: [predicates: DataPredicate[], join: PredicateJoin];
  export: [actionId: string];
  deleteSelected: [];
}>();

const searchBox = ref<HTMLElement | null>(null);
const filterAnchor = ref<HTMLElement | null>(null);

const exportActions = computed<DataAction[]>(() => [
  { id: "csv", label: "Rows shown, as CSV…" },
  { id: "json", label: "Rows shown, as JSON…" },
  {
    id: "selected",
    label: props.selectedCount
      ? `${props.selectedCount} selected, as JSON…`
      : "Selected rows, as JSON…",
    disabled: props.selectedCount === 0,
    reason: "Select rows first",
  },
]);

function focusSearch() {
  const input = searchBox.value?.querySelector("input");
  input?.focus();
  input?.select();
}

defineExpose({ focusSearch });
</script>

<template>
  <div class="flex shrink-0 flex-wrap items-center gap-1.5 px-3 py-2">
    <span ref="searchBox" class="contents">
      <SearchField
        v-model="search"
        size="sm"
        class="w-60 min-w-36 shrink"
        placeholder="Find on this page"
        aria-label="Find on this page"
      />
    </span>
    <Button
      v-if="search.trim() && !inStoreSearch"
      size="sm"
      variant="transparent"
      :loading="storeSearching"
      content-class-name="gap-1.5"
      @click="emit('searchStore')"
    >
      <ScanSearch :size="12" aria-hidden="true" />
      Search the whole store
    </Button>

    <span ref="filterAnchor" class="inline-flex">
      <Button
        size="sm"
        :variant="predicates.length ? 'solid' : 'transparent'"
        :surface-level="predicates.length ? '+2' : undefined"
        :outline="predicates.length > 0"
        content-class-name="gap-1.5"
        aria-haspopup="dialog"
        :aria-expanded="filterOpen"
        @click="filterOpen = !filterOpen"
      >
        <ListFilter :size="12" aria-hidden="true" />
        {{
          predicates.length
            ? `${predicates.length} filter${predicates.length > 1 ? "s" : ""}`
            : "Filter"
        }}
      </Button>
    </span>
    <DataFilterPopover
      v-model:open="filterOpen"
      :columns="columns"
      :predicates="predicates"
      :join="join"
      :anchor="filterAnchor"
      :seed-column="filterSeed"
      @apply="(next, nextJoin) => emit('filter', next, nextJoin)"
    />

    <span class="flex-1" />

    <IconAction
      v-if="canDelete && selectedCount > 0"
      :label="`Delete ${selectedCount} selected`"
      hint="Asks first"
      color="red"
      @click="emit('deleteSelected')"
    >
      <Trash2 :stroke-width="1.8" />
    </IconAction>
    <DataGridColumnsMenu v-model:visibility="visibility" :columns="columns" />
    <DataRowMenu
      :actions="exportActions"
      :icon="Download"
      label="Export rows"
      @select="emit('export', $event)"
    />
  </div>
</template>
