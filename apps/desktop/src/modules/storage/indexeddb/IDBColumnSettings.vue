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
import type { IDBRecord, StoreInfo } from "utils";

const props = defineProps<{
  table: Table<IDBRecord>;
  grouping: string[];
  storeInfo?: StoreInfo[];
  storeName?: string;
}>();

const emit = defineEmits<{
  "update:grouping": [value: string[]];
  "update:visibility": [columnId: string, visible: boolean];
}>();

function isColumnPrimaryKey(columnId: string): boolean {
  if (columnId === "key") return true;
  if (!props.storeInfo || !props.storeName) return false;
  const store = props.storeInfo.find((s) => s.name === props.storeName);
  if (!store || !store.keyPath) return false;
  if (typeof store.keyPath === "string" && store.keyPath === columnId) return true;
  if (Array.isArray(store.keyPath) && store.keyPath.includes(columnId)) return true;
  return false;
}

function isColumnIndexed(columnId: string): boolean {
  if (columnId === "key") return true;
  if (!props.storeInfo || !props.storeName) return false;
  const store = props.storeInfo.find((s) => s.name === props.storeName);
  if (!store || !store.indexes) return false;
  return store.indexes.some((idx) => idx.name === columnId || idx.keyPath === columnId);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T|\s|$)/;

function getColumnType(columnId: string, records: IDBRecord[], isKeyValueStore: boolean): string {
  if (columnId === "key") return "key";
  if (columnId === "value") return isKeyValueStore ? "value" : "object";

  if (!isKeyValueStore && columnId !== "__actions") {
    const sample = records.slice(0, 20);
    for (const record of sample) {
      const val = (record.value as Record<string, unknown>)?.[columnId];
      if (val !== null && val !== undefined) {
        if (typeof val === "number") return Number.isInteger(val) ? "int" : "float";
        if (typeof val === "boolean") return "bool";
        if (typeof val === "string") {
          if (ISO_DATE_RE.test(val)) return "date";
          return "string";
        }
        if (Array.isArray(val)) return "array";
        if (typeof val === "object") return "object";
      }
    }
    return "field";
  }
  return "";
}

const isKeyValueStore = computed(() => {
  const records = props.table.getFilteredRowModel().rows.map((r) => r.original);
  if (records.length === 0) return true;
  const firstValue = records[0]!.value;
  return (
    firstValue === null ||
    firstValue === undefined ||
    typeof firstValue !== "object" ||
    Array.isArray(firstValue)
  );
});

const records = computed(() => props.table.getFilteredRowModel().rows.map((r) => r.original));

function isColumnGrouped(columnId: string): boolean {
  return props.grouping.includes(columnId);
}

function toggleGrouping(columnId: string) {
  const newGrouping = isColumnGrouped(columnId)
    ? props.grouping.filter((id) => id !== columnId)
    : [...props.grouping, columnId];
  emit("update:grouping", newGrouping);
}

function toggleVisibility(columnId: string, currentVisible: boolean) {
  emit("update:visibility", columnId, !currentVisible);
}

const sortedColumns = computed(() => {
  return props.table
    .getAllLeafColumns()
    .filter((c) => c.id !== "__actions" && c.columnDef.enableHiding !== false)
    .sort((a, b) => {
      const aIsPk = isColumnPrimaryKey(a.id);
      const bIsPk = isColumnPrimaryKey(b.id);
      if (aIsPk && !bIsPk) return -1;
      if (!aIsPk && bIsPk) return 1;
      const aIsIdx = isColumnIndexed(a.id);
      const bIsIdx = isColumnIndexed(b.id);
      if (aIsIdx && !bIsIdx) return -1;
      if (!aIsIdx && bIsIdx) return 1;
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
        <span class="w-10 text-center">Type</span>
        <span class="w-5 text-center">IX</span>
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

          <span class="w-10 text-center text-xs text-muted-foreground">
            {{ getColumnType(col.id, records, isKeyValueStore) }}
          </span>

          <span class="w-5 flex justify-center">
            <span
              v-if="isColumnPrimaryKey(col.id)"
              class="w-2 h-2 rounded-full bg-warning"
              title="Primary Key"
            />
            <span
              v-else-if="isColumnIndexed(col.id)"
              class="w-2 h-2 rounded-full bg-green-500"
              title="Indexed"
            />
          </span>

          <div class="w-6 flex justify-center">
            <Checkbox
              :model-value="col.getIsVisible()"
              @update:model-value="toggleVisibility(col.id, col.getIsVisible())"
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
