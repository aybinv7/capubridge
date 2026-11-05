<script setup lang="ts">
import { computed, ref, useId } from "vue";
import {
  getCoreRowModel,
  useVueTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/vue-table";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import type { AdbPackage } from "@/types/adb.types";
import SortHeader from "@/shared/components/presentation/SortHeader.vue";
import { scrollTopToReveal } from "@/shared/list/grid";
import { optionId, rowStateClass } from "@/shared/list/rowState";
import AppIcon from "@/shared/apps/AppIcon.vue";
import AppRowActions from "./AppRowActions.vue";
import { appDisplayName } from "@/shared/apps/appIdentity";
import type { AppAction } from "@/shared/apps/appActions";
import type { AppSort, AppSortKey } from "./appsModel";
import { APP_ROW_HEIGHT } from "./appsView";

const COLUMNS = "grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5.5rem_7.5rem]";

const props = defineProps<{
  serial: string;
  apps: readonly AdbPackage[];
  selected: string | null;
  busy: boolean;
  showKind: boolean;
}>();

const sort = defineModel<AppSort>("sort", { required: true });

const emit = defineEmits<{
  select: [app: AdbPackage];
  clear: [];
  launch: [app: AdbPackage];
  action: [app: AdbPackage, action: AppAction];
}>();

const listId = useId();
const columns: ColumnDef<AdbPackage>[] = [
  { id: "name", accessorFn: (app) => appDisplayName(app) },
  { id: "package", accessorKey: "packageName" },
];
const sorting = computed<SortingState>(() => [{ id: sort.value.key, desc: sort.value.desc }]);
const table = useVueTable({
  get data() {
    return props.apps as AdbPackage[];
  },
  columns,
  manualSorting: true,
  state: {
    get sorting() {
      return sorting.value;
    },
  },
  getCoreRowModel: getCoreRowModel(),
});

const rows = computed(() => table.getRowModel().rows.map((row) => row.original));
const scroller = ref<HTMLElement | null>(null);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(rows, scroller, {
  itemHeight: APP_ROW_HEIGHT,
  overscan: 10,
});
const activeId = computed(() => {
  const name = props.selected;
  if (!name || !items.value.some((item) => item.data.packageName === name)) return undefined;
  return optionId(listId, name);
});

function sortState(id: AppSortKey): "asc" | "desc" | false {
  return sort.value.key === id ? (sort.value.desc ? "desc" : "asc") : false;
}

function toggleSort(id: AppSortKey) {
  sort.value = { key: id, desc: sort.value.key === id ? !sort.value.desc : false };
}

function stateWord(app: AdbPackage): { text: string; tone: string } | null {
  if (!app.enabled) return { text: "Disabled", tone: "text-warning" };
  if (props.showKind && app.system) return { text: "System", tone: "text-[var(--fg-subtle)]" };
  return null;
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
  } else if (event.key === "Enter") {
    const app = rows.value.find((entry) => entry.packageName === props.selected);
    if (app) emit("launch", app);
  } else if (event.key === "Escape" && props.selected) {
    event.preventDefault();
    emit("clear");
  }
}

function onClick(event: MouseEvent, app: AdbPackage) {
  if (event.detail > 1) return;
  emit("select", app);
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      class="grid h-7 shrink-0 items-center gap-3 border-b border-border-subtle px-4"
      :class="COLUMNS"
    >
      <SortHeader label="Name" :state="sortState('name')" @toggle="toggleSort('name')" />
      <SortHeader label="Package" :state="sortState('package')" @toggle="toggleSort('package')" />
      <span class="text-2xs text-muted-foreground">State</span>
      <span />
    </div>
    <div
      ref="scroller"
      class="min-h-0 flex-1 overflow-y-auto py-1 outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
      tabindex="0"
      role="listbox"
      aria-label="Apps"
      :aria-activedescendant="activeId"
      @keydown="onKeydown"
    >
      <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
      <div
        v-for="item in items"
        :id="optionId(listId, item.data.packageName)"
        :key="item.data.packageName"
        role="option"
        :aria-selected="item.data.packageName === props.selected"
        class="group/row mx-1.5 grid cursor-default items-center gap-3 rounded-control px-2.5"
        :class="[COLUMNS, rowStateClass(item.data.packageName === props.selected)]"
        :style="{ height: `${APP_ROW_HEIGHT}px` }"
        @click="onClick($event, item.data)"
        @dblclick="emit('launch', item.data)"
      >
        <span class="flex min-w-0 items-center gap-2.5">
          <AppIcon
            :serial="props.serial"
            :apk-path="item.data.apkPath"
            :package-name="item.data.packageName"
            :icon-path="item.data.iconPath"
            :label="appDisplayName(item.data)"
            size="xs"
            :class="{ 'opacity-50 grayscale': !item.data.enabled }"
          />
          <span class="truncate text-sm text-foreground">{{ appDisplayName(item.data) }}</span>
        </span>
        <span
          class="truncate font-mono text-2xs text-[var(--fg-subtle)]"
          :title="item.data.apkPath || item.data.packageName"
        >
          {{ item.data.packageName }}
        </span>
        <span class="truncate text-2xs" :class="stateWord(item.data)?.tone">
          {{ stateWord(item.data)?.text }}
        </span>
        <AppRowActions
          class="justify-end opacity-0 transition-opacity duration-120 group-hover/row:opacity-100"
          :class="item.data.packageName === props.selected && 'opacity-100'"
          :busy="props.busy"
          :system="item.data.system"
          @launch="emit('launch', item.data)"
          @action="emit('action', item.data, $event)"
        />
      </div>
      <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
    </div>
  </div>
</template>
