<script setup lang="ts">
import { computed } from "vue";
import type { Table } from "@tanstack/vue-table";
import { Layers } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { RowRecord } from "./useSqliteAdvancedFilters";
import type { SqliteColumnInfo } from "@/types/sqlite.types";

const props = defineProps<{
  table: Table<RowRecord>;
  grouping: string[];
  columnInfo?: SqliteColumnInfo[];
}>();

const emit = defineEmits<{
  "update:grouping": [value: string[]];
}>();

function isColumnPrimaryKey(columnId: string): boolean {
  if (!props.columnInfo) return false;
  return props.columnInfo.some((c) => c.name === columnId && c.pk > 0);
}

function getColumnType(columnId: string): string {
  if (!props.columnInfo) return "";
  const col = props.columnInfo.find((c) => c.name === columnId);
  if (!col) return "";
  return col.type.toLowerCase() || "any";
}

function isColumnGrouped(columnId: string): boolean {
  return props.grouping.includes(columnId);
}

function toggleGrouping(columnId: string) {
  const newGrouping = isColumnGrouped(columnId)
    ? props.grouping.filter((id) => id !== columnId)
    : [...props.grouping, columnId];
  emit("update:grouping", newGrouping);
}

const sortedColumns = computed(() => {
  return props.table
    .getAllLeafColumns()
    .filter((c) => c.id !== "__select" && c.columnDef.enableHiding !== false)
    .sort((a, b) => {
      const aIsPk = isColumnPrimaryKey(a.id);
      const bIsPk = isColumnPrimaryKey(b.id);
      if (aIsPk && !bIsPk) return -1;
      if (!aIsPk && bIsPk) return 1;
      return 0;
    });
});
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-sm" class="h-7 w-7 relative" title="Column Settings">
        <Layers class="h-3.5 w-3.5" />
        <span
          v-if="grouping.length > 0"
          class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-warning rounded-full"
        />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-60 max-h-80 overflow-y-auto p-0">
      <DropdownMenuLabel class="px-3 py-2">Columns</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <div
        class="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground font-medium border-b border-border/30"
      >
        <span class="flex-1">Name</span>
        <span class="w-12 text-center">Type</span>
        <span class="w-5 text-center">PK</span>
        <span class="w-6 text-center">Vis</span>
        <span class="w-6 text-center">Grp</span>
      </div>
      <DropdownMenuGroup>
        <DropdownMenuItem
          v-for="col in sortedColumns"
          :key="col.id"
          class="flex items-center gap-1 py-1.5 cursor-default px-3"
        >
          <span class="flex-1 truncate text-xs text-foreground/80">
            {{ col.columnDef.header ?? col.id }}
          </span>

          <span class="w-12 text-center text-[10px] text-muted-foreground font-mono">
            {{ getColumnType(col.id) }}
          </span>

          <span class="w-5 flex justify-center">
            <span
              v-if="isColumnPrimaryKey(col.id)"
              class="w-2 h-2 rounded-full bg-warning"
              title="Primary Key"
            />
          </span>

          <div class="w-6 flex justify-center">
            <Checkbox
              :model-value="col.getIsVisible()"
              @update:model-value="col.toggleVisibility()"
              @click.stop
              class="h-3.5 w-3.5"
            />
          </div>

          <div class="w-6 flex justify-center">
            <Checkbox
              :model-value="isColumnGrouped(col.id)"
              @update:model-value="toggleGrouping(col.id)"
              @click.stop
              class="h-3.5 w-3.5"
            />
          </div>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
