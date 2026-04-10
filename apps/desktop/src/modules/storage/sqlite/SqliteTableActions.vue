<script setup lang="ts">
import { computed } from "vue";
import type { Table } from "@tanstack/vue-table";
import { Search, X, Copy, Layers, Table2, Maximize2, Minimize2, Download } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "vue-sonner";
import type { RowRecord, AdvancedFilter } from "./useSqliteAdvancedFilters";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import { useSqliteTableExport } from "./useSqliteTableExport";
import SqliteColumnSettings from "./SqliteColumnSettings.vue";
import SqliteFilterBuilder from "./SqliteFilterBuilder.vue";

const props = defineProps<{
  table: Table<RowRecord>;
  grouping: string[];
  dbName: string;
  tableName: string;
  columnInfo?: SqliteColumnInfo[];
  advancedFilters?: AdvancedFilter[];
}>();

const emit = defineEmits<{
  "update:grouping": [value: string[]];
  "update:filters": [filters: AdvancedFilter[]];
}>();

const { exportToCSV, exportToJSON, exportSelectedToJSON } = useSqliteTableExport(
  props.table,
  () => props.dbName,
  () => props.tableName,
);

const globalFilter = computed({
  get: () => props.table.getState().globalFilter ?? "",
  set: (value) => props.table.setGlobalFilter(value),
});

const filteredRowCount = computed(() => props.table.getFilteredRowModel().rows.length);
const selectedRowCount = computed(() => props.table.getSelectedRowModel().rows.length);
const hasActiveFilters = computed(
  () => props.table.getState().columnFilters.length > 0 || globalFilter.value !== "",
);
const hasAdvancedFilters = computed(() => (props.advancedFilters?.length ?? 0) > 0);

function clearAllFilters() {
  props.table.setColumnFilters([]);
  globalFilter.value = "";
  emit("update:filters", []);
}

async function copySelectedToClipboard() {
  const selectedRows = props.table.getSelectedRowModel().rows;
  if (selectedRows.length === 0) return;
  const records = selectedRows.map((row) => row.original);
  const json = JSON.stringify(records, null, 2);
  await navigator.clipboard.writeText(json);
  toast.success("Copied to clipboard", {
    description: `${selectedRows.length} records copied`,
  });
}

function autoSizeColumns() {
  const sizing: Record<string, number> = {};
  props.table.getAllLeafColumns().forEach((col) => {
    if (col.id !== "__select" && col.columnDef.size) {
      sizing[col.id] = col.columnDef.size;
    }
  });
  props.table.setColumnSizing(sizing);
}

function fitColumnsToGrid() {
  const visibleColumns = props.table.getVisibleFlatColumns().filter((c) => c.id !== "__select");
  if (visibleColumns.length === 0) return;
  const containerWidth = 1200;
  const availableWidth = containerWidth - 48;
  const perColumn = Math.floor(availableWidth / visibleColumns.length);
  const sizing: Record<string, number> = {};
  visibleColumns.forEach((col) => {
    sizing[col.id] = Math.max(perColumn, col.columnDef.minSize ?? 80);
  });
  props.table.setColumnSizing(sizing);
}

function resetColumnLayout() {
  props.table.resetColumnVisibility();
  props.table.resetColumnOrder();
  props.table.resetColumnPinning();
}
</script>

<template>
  <div
    class="flex shrink-0 items-center gap-2 border-b border-border/30 bg-surface-2 px-3 py-2 flex-wrap"
  >
    <!-- Global Search -->
    <div class="relative flex-1 min-w-[200px] max-w-md">
      <Search
        class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40"
      />
      <Input
        :model-value="globalFilter"
        placeholder="Search all columns…"
        class="h-7 pl-8 text-xs bg-surface-3 border-border/30 focus:border-border/60"
        @update:model-value="globalFilter = $event ?? ''"
      />
      <button
        v-if="globalFilter"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"
        @click="globalFilter = ''"
      >
        <X class="h-3 w-3" />
      </button>
    </div>

    <!-- Filter Builder -->
    <SqliteFilterBuilder
      :table="table"
      :filters="advancedFilters"
      @update:filters="(f) => emit('update:filters', f)"
    />

    <!-- Filter indicators -->
    <div v-if="hasActiveFilters || hasAdvancedFilters" class="flex items-center gap-1">
      <span class="text-[10px] text-muted-foreground/50"> {{ filteredRowCount }} filtered </span>
      <Button variant="ghost" size="icon-sm" class="h-5 w-5" @click="clearAllFilters">
        <X class="h-3 w-3" />
      </Button>
    </div>

    <div class="flex-1" />

    <!-- Selection Actions Bar -->
    <div
      v-if="selectedRowCount > 0"
      class="flex items-center gap-1 shrink-0 px-2 rounded-md bg-warning/10 border border-warning/30"
    >
      <span class="text-[10px] font-medium text-warning/80 tabular-nums shrink-0 px-1">
        {{ selectedRowCount }} selected
      </span>

      <div class="flex items-center gap-0.5 border-l border-warning/30 pl-2 ml-1">
        <Button
          variant="ghost"
          size="icon-sm"
          class="h-6 w-6 text-muted-foreground hover:text-foreground"
          title="Copy selected as JSON"
          @click="copySelectedToClipboard"
        >
          <Copy class="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          class="h-6 w-6 text-muted-foreground hover:text-foreground"
          title="Clear selection"
          @click="props.table.resetRowSelection()"
        >
          <X class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>

    <!-- Column Visibility & Grouping -->
    <SqliteColumnSettings
      :table="table"
      :grouping="grouping"
      :column-info="columnInfo"
      @update:grouping="emit('update:grouping', $event)"
    />

    <!-- Column Layout -->
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="icon-sm" class="h-7 w-7" title="Layout options">
          <Table2 class="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-48">
        <DropdownMenuLabel>Layout</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="autoSizeColumns">
          <Maximize2 class="h-3.5 w-3.5 mr-2" />
          Auto-size columns
        </DropdownMenuItem>
        <DropdownMenuItem @click="fitColumnsToGrid">
          <Minimize2 class="h-3.5 w-3.5 mr-2" />
          Fit to grid
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="resetColumnLayout"> Reset layout </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Export -->
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="icon-sm" class="h-7 w-7" title="Export data">
          <Download class="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-48">
        <DropdownMenuLabel>Export</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="exportToCSV"> CSV (filtered) </DropdownMenuItem>
        <DropdownMenuItem @click="exportToJSON"> JSON (filtered) </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem :disabled="selectedRowCount === 0" @click="exportSelectedToJSON">
          Selected ({{ selectedRowCount }})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
