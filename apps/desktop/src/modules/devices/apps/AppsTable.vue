<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import {
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/vue-table";
import { Chip } from "@capubridge/cladd";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import type { AdbPackage } from "@/types/adb.types";
import SortHeader from "../shared/SortHeader.vue";
import { scrollTopToReveal } from "../shared/grid";
import AppIcon from "../AppIcon.vue";
import AppRowActions from "./AppRowActions.vue";
import { appDisplayName, type AppAction } from "./appsModel";
import { APP_ROW_HEIGHT } from "./appsView";

const HEADER_HEIGHT = 30;

const props = defineProps<{
  serial: string;
  apps: readonly AdbPackage[];
  selected: string | null;
  busy: boolean;
  showKind: boolean;
}>();

const emit = defineEmits<{
  toggle: [app: AdbPackage];
  select: [app: AdbPackage];
  launch: [app: AdbPackage];
  action: [app: AdbPackage, action: AppAction];
}>();

const sorting = shallowRef<SortingState>([{ id: "name", desc: false }]);
const columns: ColumnDef<AdbPackage>[] = [
  { id: "name", accessorFn: (app) => appDisplayName(app).toLowerCase(), sortingFn: "text" },
];

const table = useVueTable({
  get data() {
    return props.apps as AdbPackage[];
  },
  columns,
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

const rows = computed(() => table.getRowModel().rows.map((row) => row.original));
const scroller = ref<HTMLElement | null>(null);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(rows, scroller, {
  itemHeight: APP_ROW_HEIGHT,
  overscan: 8,
});

function sortState(id: string): "asc" | "desc" | false {
  return table.getColumn(id)?.getIsSorted() ?? false;
}

function toggleSort(id: string) {
  table.getColumn(id)?.toggleSorting();
}

function move(step: number) {
  const list = rows.value;
  if (!list.length) return;
  const current = list.findIndex((app) => app.packageName === props.selected);
  const next = Math.min(list.length - 1, Math.max(0, current < 0 ? 0 : current + step));
  const app = list[next];
  if (!app) return;
  emit("select", app);
  const element = scroller.value;
  if (element) {
    element.scrollTop = scrollTopToReveal(
      next,
      APP_ROW_HEIGHT,
      element.scrollTop,
      element.clientHeight,
      HEADER_HEIGHT,
    );
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    move(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    move(event.key === "Home" ? -Infinity : Infinity);
  }
}
</script>

<template>
  <div
    ref="scroller"
    class="h-full overflow-y-auto outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
    tabindex="0"
    role="listbox"
    aria-label="Apps"
    @keydown="onKeydown"
  >
    <div
      class="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3 border-b border-border-subtle bg-card px-4"
      :style="{ height: `${HEADER_HEIGHT}px` }"
    >
      <SortHeader label="Name" :state="sortState('name')" @toggle="toggleSort('name')" />
      <span />
    </div>
    <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
    <div
      v-for="item in items"
      :key="item.data.packageName"
      role="option"
      :aria-selected="item.data.packageName === props.selected"
      class="group/row mx-1.5 grid cursor-default grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3 rounded-control px-2.5"
      :class="
        item.data.packageName === props.selected
          ? 'bg-cladd-surface-next shadow-bevel'
          : 'hover:bg-cladd-surface-hover'
      "
      :style="{ height: `${APP_ROW_HEIGHT}px` }"
      @click="emit('toggle', item.data)"
      @dblclick="emit('launch', item.data)"
    >
      <span class="flex min-w-0 items-center gap-3">
        <AppIcon
          :serial="props.serial"
          :apk-path="item.data.apkPath"
          :package-name="item.data.packageName"
          :icon-path="item.data.iconPath"
          size="sm"
          :class="{ 'opacity-50 grayscale': !item.data.enabled }"
        />
        <span class="flex min-w-0 flex-col">
          <span class="flex min-w-0 items-center gap-2">
            <span class="truncate text-sm text-foreground">{{ appDisplayName(item.data) }}</span>
            <Chip v-if="props.showKind && item.data.system" size="xs" class="shrink-0">
              System
            </Chip>
            <Chip v-if="!item.data.enabled" size="xs" color="yellow" class="shrink-0">
              Disabled
            </Chip>
          </span>
          <span
            class="truncate font-mono text-2xs text-[var(--fg-subtle)]"
            :title="item.data.apkPath"
          >
            {{ item.data.packageName }}
          </span>
        </span>
      </span>
      <AppRowActions
        class="justify-end opacity-0 transition-opacity duration-120 group-hover/row:opacity-100 group-focus-within/row:opacity-100"
        :busy="props.busy"
        @launch="emit('launch', item.data)"
        @action="emit('action', item.data, $event)"
      />
    </div>
    <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
  </div>
</template>
