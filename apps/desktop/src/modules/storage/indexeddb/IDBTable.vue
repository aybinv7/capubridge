<script setup lang="ts">
import { computed, ref } from "vue";
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  FlexRender,
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
    <div v-if="isLoading && records.length === 0" class="flex flex-col gap-px p-4">
      <div
        v-for="i in 10"
        :key="i"
        class="h-9 animate-pulse bg-surface-3/50"
        :style="{ animationDelay: `${i * 40}ms` }"
      />
    </div>

    <!-- Empty -->
    <div
      v-else-if="!isLoading && records.length === 0"
      class="flex h-40 items-center justify-center text-sm text-muted-foreground/30"
    >
      No records in this store
    </div>

    <!-- Table -->
    <table v-else class="w-full border-collapse text-sm" style="table-layout: fixed">
      <thead>
        <tr>
          <th
            v-for="header in table.getFlatHeaders()"
            :key="header.id"
            :style="{ width: header.getSize() + 'px' }"
            class="sticky top-0 z-[1] h-10 border-b border-border/30 bg-surface-2 px-4 text-left text-xs font-medium text-muted-foreground/50 select-none truncate"
            :class="{
              'cursor-pointer hover:text-muted-foreground hover:bg-surface-3/50':
                header.column.getCanSort(),
            }"
            @click="header.column.getToggleSortingHandler()?.($event)"
          >
            <span class="flex items-center gap-1">
              <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
              <span
                v-if="header.column.getIsSorted() === 'asc'"
                class="text-xs text-muted-foreground"
                >↑</span
              >
              <span
                v-else-if="header.column.getIsSorted() === 'desc'"
                class="text-xs text-muted-foreground"
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
          class="group border-b border-border/20 hover:bg-surface-2/50 transition-colors duration-75"
        >
          <td
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
            class="h-9 overflow-hidden text-ellipsis whitespace-nowrap px-4 font-mono text-foreground/80 max-w-[300px]"
          >
            <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
