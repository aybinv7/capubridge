<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { Download, Group, X } from "lucide-vue-next";
import { Button, Popover, SearchField } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { DataGridColumnsMenu, type GridColumn } from "@/shared/components/data/grid";
import SqliteFilterChips from "./SqliteFilterChips.vue";
import SqliteFilterPopover from "./SqliteFilterPopover.vue";
import type { SqliteExportFormat, SqliteExportScope } from "./sqliteQuery";
import type { SqliteTableQuery } from "./useSqliteTableQuery";

/**
 * The rows' toolbar: the view switch (slot), search as the widest control, the active filters
 * as chips, then Filter, the change summary (slot), columns, export and the table's actions.
 */
const props = defineProps<{
  query: SqliteTableQuery;
  columns: readonly GridColumn[];
  selectedRows: number;
  /** Why the filters did not run, from the database. */
  filterError: string | null;
}>();

defineSlots<{ lead?: () => unknown; changes?: () => unknown; trail?: () => unknown }>();

const visibility = defineModel<Record<string, boolean>>("visibility", { required: true });

const emit = defineEmits<{ export: [format: SqliteExportFormat, scope: SqliteExportScope] }>();

const root = ref<HTMLElement | null>(null);
const filter = ref<InstanceType<typeof SqliteFilterPopover> | null>(null);
defineExpose({
  focusSearch: () =>
    root.value?.querySelector<HTMLInputElement>('input[aria-label="Search all columns"]')?.focus(),
  openFilter: (column?: string) => filter.value?.openFor({ column }),
  openWhere: () => filter.value?.openFor({ where: true }),
});

const SEARCH_DELAY_MS = 250;
const searchDraft = ref(props.query.search.value);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(searchDraft, (draft) => {
  if (searchTimer !== null) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => props.query.setSearch(draft), SEARCH_DELAY_MS);
});
watch(
  () => props.query.search.value,
  (applied) => {
    if (applied !== searchDraft.value) searchDraft.value = applied;
  },
);
onBeforeUnmount(() => {
  if (searchTimer !== null) clearTimeout(searchTimer);
});

const FORMATS: Array<{ value: SqliteExportFormat; label: string }> = [
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL INSERT statements" },
];
</script>

<template>
  <div ref="root" class="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 px-2 py-2">
    <slot name="lead" />
    <SearchField
      v-model="searchDraft"
      size="sm"
      class="min-w-48 flex-1"
      placeholder="Search rows"
      aria-label="Search all columns"
    />
    <SqliteFilterChips
      :filters="query.filters.value"
      :where="query.whereClause.value"
      :error="filterError"
      @remove="query.removeFilter"
      @clear-where="query.setWhere('')"
    />
    <HintTooltip
      v-if="query.groupBy.value"
      :text="`Grouped by ${query.groupBy.value}. Click to show the rows again.`"
    >
      <Button
        size="sm"
        variant="solid"
        content-class-name="gap-1.5"
        :aria-label="`Stop grouping by ${query.groupBy.value}`"
        @click="query.setGroupBy(null)"
      >
        <Group :size="13" aria-hidden="true" />
        <span class="font-mono">{{ query.groupBy.value }}</span>
        <X :size="12" aria-hidden="true" />
      </Button>
    </HintTooltip>
    <SqliteFilterPopover
      ref="filter"
      :query="query"
      :columns="columns.map((column) => column.id)"
      :error="filterError"
    />
    <slot name="changes" />
    <DataGridColumnsMenu v-model:visibility="visibility" :columns="columns" />
    <Popover position="bottom-end" content-class-name="w-60 p-1">
      <template #trigger>
        <Button size="sm" variant="transparent" :outline="false" content-class-name="gap-1.5">
          <Download :size="13" aria-hidden="true" />
          Export
        </Button>
      </template>
      <template #default="{ close }">
        <div class="flex flex-col">
          <template v-for="scope in ['all', 'selected'] as const" :key="scope">
            <p
              v-if="scope === 'all' || selectedRows > 0"
              class="px-2 pt-2 pb-1 text-cladd-2xs font-semibold tracking-wide text-cladd-fg-softer uppercase"
            >
              {{
                scope === "selected"
                  ? `Selected rows (${selectedRows})`
                  : query.needsQuery.value
                    ? "Rows matching the filter"
                    : "Every row of the table"
              }}
            </p>
            <template v-if="scope === 'all' || selectedRows > 0">
              <Button
                v-for="format in FORMATS"
                :key="`${scope}-${format.value}`"
                size="sm"
                variant="transparent"
                :outline="false"
                content-class-name="w-full justify-start"
                @click="
                  emit('export', format.value, scope);
                  close();
                "
              >
                {{ format.label }}
              </Button>
            </template>
          </template>
        </div>
      </template>
    </Popover>
    <slot name="trail" />
  </div>
</template>
