<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementSize } from "@vueuse/core";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import type { AdbPackage } from "@/types/adb.types";
import AppIcon from "../AppIcon.vue";
import { chunkRows, scrollTopToReveal } from "../shared/grid";
import { appDisplayName } from "./appsModel";
import { APP_TILES, gridColumns, type AppsDensity } from "./appsView";

const GRID_PADDING = 12;

const props = defineProps<{
  serial: string;
  apps: readonly AdbPackage[];
  selected: string | null;
  density: AppsDensity;
}>();

const emit = defineEmits<{
  toggle: [app: AdbPackage];
  select: [app: AdbPackage];
  launch: [app: AdbPackage];
}>();

const scroller = ref<HTMLElement | null>(null);
const { width } = useElementSize(scroller);
const tile = computed(() => APP_TILES[props.density]);
const columns = computed(() =>
  gridColumns(Math.max(0, width.value - GRID_PADDING * 2), props.density),
);
const rows = computed(() => chunkRows(props.apps, columns.value));
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(rows, scroller, {
  itemHeight: tile.value.height,
  overscan: 3,
});

function move(step: number) {
  const list = props.apps;
  if (!list.length) return;
  const current = list.findIndex((app) => app.packageName === props.selected);
  const next = Math.min(list.length - 1, Math.max(0, current < 0 ? 0 : current + step));
  const app = list[next];
  if (!app) return;
  emit("select", app);
  const element = scroller.value;
  if (element) {
    element.scrollTop = scrollTopToReveal(
      Math.floor(next / columns.value),
      tile.value.height,
      element.scrollTop,
      element.clientHeight,
      GRID_PADDING,
    );
  }
}

function onKeydown(event: KeyboardEvent) {
  const steps: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: columns.value,
    ArrowUp: -columns.value,
  };
  const step = steps[event.key];
  if (step !== undefined) {
    event.preventDefault();
    move(step);
  } else if (event.key === "Enter") {
    const app = props.apps.find((entry) => entry.packageName === props.selected);
    if (app) emit("launch", app);
  }
}
</script>

<template>
  <div
    ref="scroller"
    class="h-full overflow-y-auto outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
    :style="{ padding: `${GRID_PADDING}px` }"
    tabindex="0"
    role="listbox"
    aria-label="Apps"
    @keydown="onKeydown"
  >
    <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
    <div
      v-for="row in items"
      :key="row.index"
      class="grid"
      :style="{
        height: `${tile.height}px`,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }"
    >
      <button
        v-for="app in row.data"
        :key="app.packageName"
        type="button"
        role="option"
        tabindex="-1"
        :aria-selected="app.packageName === props.selected"
        class="m-0.5 flex min-w-0 flex-col items-center justify-center gap-2 rounded-well px-2 outline-none"
        :class="
          app.packageName === props.selected
            ? 'bg-cladd-surface-next shadow-bevel'
            : 'hover:bg-cladd-surface-hover'
        "
        :title="app.packageName"
        @click="emit('toggle', app)"
        @dblclick="emit('launch', app)"
      >
        <AppIcon
          :serial="props.serial"
          :apk-path="app.apkPath"
          :package-name="app.packageName"
          :icon-path="app.iconPath"
          :size="tile.icon"
          :class="{ 'opacity-50 grayscale': !app.enabled }"
        />
        <span class="line-clamp-2 w-full text-center text-xs leading-tight text-foreground">
          {{ appDisplayName(app) }}
        </span>
      </button>
    </div>
    <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
  </div>
</template>
