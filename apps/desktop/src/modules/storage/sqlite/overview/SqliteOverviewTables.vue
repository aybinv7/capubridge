<script setup lang="ts">
import { computed, ref } from "vue";
import { X } from "lucide-vue-next";
import { Chip, SearchField, Segmented, SegmentedButton, SurfaceCut } from "@capubridge/cladd";
import { DataGrid, type GridSort } from "@/shared/components/data/grid";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import {
  filterRows,
  OVERVIEW_COLUMNS,
  sortRows,
  toOverviewGridRows,
  type OverviewSegment,
  type OverviewTableRow,
} from "./sqliteOverviewRows";

/**
 * Every table and view in one sortable grid (largest on disk first): rows, size and share of the
 * file, indexes, a missing key, detected sync columns, and what changed while watched. Segments
 * narrow it; a check's "Show" narrows it to its tables (a chip says so). Enter or a double-click
 * opens the table in a kept tab.
 */
const props = defineProps<{
  rows: readonly OverviewTableRow[];
  /** Tables a schema check asked to show, with its words; `null` shows all. */
  only: { label: string; tables: ReadonlySet<string> } | null;
}>();

const emit = defineEmits<{ open: [table: string]; clearOnly: [] }>();

const SEGMENTS: Array<{ id: OverviewSegment; label: string }> = [
  { id: "all", label: "All" },
  { id: "changed", label: "Changed" },
  { id: "sync", label: "Sync" },
  { id: "no-key", label: "No key" },
  { id: "empty", label: "Empty" },
];

const segment = ref<OverviewSegment>("all");
const filter = ref("");
const sort = ref<GridSort | null>(null);

const shown = computed(() =>
  sortRows(
    filterRows(props.rows, segment.value, filter.value, props.only?.tables ?? null),
    sort.value,
  ),
);
const gridRows = computed(() => toOverviewGridRows(shown.value));
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col gap-2" aria-label="Tables and views">
    <div class="flex flex-wrap items-center gap-2">
      <SearchField
        v-model="filter"
        size="sm"
        class="min-w-40 flex-1"
        placeholder="Filter tables"
        aria-label="Filter tables"
      />
      <Segmented size="xs" active-variant="solid" aria-label="Which tables">
        <SegmentedButton
          v-for="entry in SEGMENTS"
          :key="entry.id"
          :active="segment === entry.id"
          @click="segment = entry.id"
        >
          {{ entry.label }}
        </SegmentedButton>
      </Segmented>
      <Chip v-if="only" size="xl" content-class-name="gap-1 pr-0.5">
        <span class="text-2xs">{{ only.label }}</span>
        <IconAction size="xs" label="Show every table" @click="emit('clearOnly')">
          <X :stroke-width="1.8" />
        </IconAction>
      </Chip>
    </div>
    <SurfaceCut class="min-h-0 flex-1 rounded-well" content-class-name="h-full min-h-0">
      <DataGrid
        frame="none"
        label="Tables and views"
        :columns="OVERVIEW_COLUMNS"
        :rows="gridRows"
        :sort="sort"
        read-only
        activate-rows
        :column-features="{ filter: false, group: false, showAs: false }"
        layout-key="sqlite:overview"
        @update:sort="sort = $event"
        @activate="emit('open', $event)"
      >
        <template #empty>
          <span>{{ rows.length ? "No table matches." : "This database has no tables." }}</span>
        </template>
      </DataGrid>
    </SurfaceCut>
  </section>
</template>
