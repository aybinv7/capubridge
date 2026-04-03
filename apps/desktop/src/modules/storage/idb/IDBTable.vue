<script setup lang="ts">
import { computed, ref } from "vue";
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/vue-table";
import type { IDBRecord } from "utils";

const props = defineProps<{
  records: IDBRecord[];
  isLoading: boolean;
}>();

const sorting = ref<SortingState>([]);
const columnHelper = createColumnHelper<IDBRecord>();

const columns = computed(() => {
  if (props.records.length === 0) return [];

  const firstValue = props.records[0]!.value;
  const valueKeys =
    firstValue !== null && typeof firstValue === "object"
      ? Object.keys(firstValue as Record<string, unknown>).slice(0, 20)
      : [];

  const cols = [
    columnHelper.accessor("key", {
      header: "Key",
      size: 120,
      cell: (info) => String(info.getValue()),
    }),
  ];

  if (valueKeys.length > 0) {
    for (const key of valueKeys) {
      cols.push(
        columnHelper.accessor((row) => (row.value as Record<string, unknown>)?.[key], {
          id: key,
          header: key,
          cell: (info) => {
            const v = info.getValue();
            if (v === null || v === undefined) return "";
            if (typeof v === "object") return JSON.stringify(v);
            return String(v);
          },
        }),
      );
    }
  } else {
    cols.push(
      columnHelper.accessor("value", {
        header: "Value",
        cell: (info) => {
          const v = info.getValue();
          if (v === null || v === undefined) return "";
          if (typeof v === "object") return JSON.stringify(v);
          return String(v);
        },
      }),
    );
  }

  return cols;
});

const table = useVueTable({
  get data() {
    return props.records;
  },
  get columns() {
    return columns.value;
  },
  state: {
    get sorting() {
      return sorting.value;
    },
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === "function" ? updater(sorting.value) : updater;
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});
</script>

<template>
  <div class="relative flex-1 overflow-auto">
    <!-- Loading shimmer -->
    <div v-if="isLoading && records.length === 0" class="flex flex-col gap-px p-3">
      <div
        v-for="i in 10"
        :key="i"
        class="h-7 animate-pulse bg-muted/60"
        :style="{ animationDelay: `${i * 40}ms` }"
      />
    </div>

    <!-- Empty -->
    <div
      v-else-if="!isLoading && records.length === 0"
      class="flex h-32 items-center justify-center text-[12px] text-muted-foreground/40"
    >
      No records in this store
    </div>

    <!-- Table -->
    <table v-else class="w-full border-collapse text-[12px]" style="table-layout: fixed">
      <thead>
        <tr>
          <th
            v-for="header in table.getFlatHeaders()"
            :key="header.id"
            :style="{ width: header.getSize() + 'px' }"
            class="sticky top-0 z-[1] h-8 border-b border-border bg-card px-2.5 text-left text-[11px] font-semibold text-muted-foreground/60 select-none truncate"
            :class="{
              'cursor-pointer hover:text-foreground hover:bg-muted': header.column.getCanSort(),
            }"
            @click="header.column.getToggleSortingHandler()?.($event)"
          >
            <span class="flex items-center gap-1">
              <flexRender :render="header.column.columnDef.header" :props="header.getContext()" />
              <span v-if="header.column.getIsSorted() === 'asc'" class="text-[10px] text-primary"
                >↑</span
              >
              <span
                v-else-if="header.column.getIsSorted() === 'desc'"
                class="text-[10px] text-primary"
                >↓</span
              >
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          class="group border-b border-border/50 hover:bg-accent/30 transition-colors duration-75"
        >
          <td
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
            class="h-7 overflow-hidden text-ellipsis whitespace-nowrap px-2.5 font-mono text-foreground max-w-[300px]"
          >
            <flexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
