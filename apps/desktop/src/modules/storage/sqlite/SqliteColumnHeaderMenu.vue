<script setup lang="ts">
import type { Header } from "@tanstack/vue-table";
import {
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  EyeOff,
  Pin,
  Layers,
  Check,
  Pencil,
} from "lucide-vue-next";
import type { RowRecord } from "./useSqliteAdvancedFilters";
import { EDITOR_KINDS, type SqliteEditorKind } from "./cellEditorTypes";

const props = defineProps<{
  header: Header<RowRecord, unknown>;
  isGrouped: boolean;
  dbName: string;
  tableName: string;
  detectedKind: SqliteEditorKind;
  currentOverride: SqliteEditorKind | null;
}>();

const emit = defineEmits<{
  addFilter: [columnId: string];
  toggleGrouping: [columnId: string];
  clearOverride: [dbName: string, tableName: string, columnId: string];
  setOverride: [dbName: string, tableName: string, columnId: string, kind: SqliteEditorKind];
}>();
</script>

<template>
  <DropdownMenuContent align="start" class="w-48 max-h-72 overflow-y-auto">
    <DropdownMenuLabel class="text-[10px] uppercase tracking-wider">
      {{ header.column.columnDef.header ?? header.column.id }}
    </DropdownMenuLabel>
    <DropdownMenuSeparator />

    <!-- Sort -->
    <DropdownMenuGroup v-if="header.column.getCanSort()">
      <DropdownMenuItem
        class="text-xs"
        :class="{ 'bg-accent': header.column.getIsSorted() === 'asc' }"
        @click="header.column.toggleSorting(false)"
      >
        <ArrowUp class="h-3 w-3 mr-2" />
        Ascending
      </DropdownMenuItem>
      <DropdownMenuItem
        class="text-xs"
        :class="{ 'bg-accent': header.column.getIsSorted() === 'desc' }"
        @click="header.column.toggleSorting(true)"
      >
        <ArrowDown class="h-3 w-3 mr-2" />
        Descending
      </DropdownMenuItem>
      <DropdownMenuItem
        v-if="header.column.getIsSorted()"
        class="text-xs text-muted-foreground"
        @click="header.column.clearSorting()"
      >
        <ArrowUpDown class="h-3 w-3 mr-2" />
        Clear sort
      </DropdownMenuItem>
    </DropdownMenuGroup>

    <DropdownMenuSeparator v-if="header.column.getCanSort()" />

    <!-- Filter -->
    <DropdownMenuItem class="text-xs" @click="emit('addFilter', header.column.id)">
      <Filter class="h-3 w-3 mr-2" />
      Filter...
    </DropdownMenuItem>
    <DropdownMenuItem
      v-if="header.column.getIsFiltered()"
      class="text-xs text-muted-foreground"
      @click="header.column.setFilterValue(undefined)"
    >
      <X class="h-3 w-3 mr-2" />
      Clear filter
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    <!-- Group by -->
    <DropdownMenuItem class="text-xs" @click="emit('toggleGrouping', header.column.id)">
      <Layers class="h-3 w-3 mr-2" />
      {{ isGrouped ? "Ungroup" : "Group by" }}
    </DropdownMenuItem>

    <!-- Editor override: SQLite has no date/bool type, so
         detection guesses. This makes a wrong guess fixable. -->
    <DropdownMenuSub>
      <DropdownMenuSubTrigger class="text-xs">
        <Pencil class="h-3 w-3 mr-2" />
        Cell editor
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem
          class="text-xs"
          @click="emit('clearOverride', dbName, tableName, header.column.id)"
        >
          Auto
          <span class="ml-auto pl-2 text-[10px] text-muted-foreground/50">
            {{ detectedKind }}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          v-for="kind in EDITOR_KINDS"
          :key="kind"
          class="text-xs capitalize"
          @click="emit('setOverride', dbName, tableName, header.column.id, kind)"
        >
          {{ kind }}
          <Check v-if="currentOverride === kind" class="ml-auto h-3 w-3" />
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>

    <!-- Pin -->
    <DropdownMenuSub>
      <DropdownMenuSubTrigger class="text-xs">
        <Pin class="h-3 w-3 mr-2" />
        Pin column
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem
          class="text-xs"
          :class="{ 'bg-accent': header.column.getIsPinned() === 'left' }"
          @click="header.column.pin('left')"
        >
          Pin to left
        </DropdownMenuItem>
        <DropdownMenuItem
          class="text-xs"
          :class="{ 'bg-accent': header.column.getIsPinned() === 'right' }"
          @click="header.column.pin('right')"
        >
          Pin to right
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="header.column.getIsPinned()"
          class="text-xs text-muted-foreground"
          @click="header.column.pin(false)"
        >
          Unpin
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>

    <!-- Hide -->
    <DropdownMenuItem
      class="text-xs text-muted-foreground"
      @click="header.column.toggleVisibility(false)"
    >
      <EyeOff class="h-3 w-3 mr-2" />
      Hide column
    </DropdownMenuItem>
  </DropdownMenuContent>
</template>
