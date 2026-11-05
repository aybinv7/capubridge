<script setup lang="ts">
import { computed, ref, useId } from "vue";
import { useElementSize } from "@vueuse/core";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import type { AdbPackage } from "@/types/adb.types";
import AppIcon from "../AppIcon.vue";
import { chunkRows, scrollTopToReveal } from "@/shared/list/grid";
import { optionId, rowStateClass } from "@/shared/list/rowState";
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
  select: [app: AdbPackage];
  clear: [];
  launch: [app: AdbPackage];
}>();

const listId = useId();

const scroller = ref<HTMLElement | null>(null);
const { width } = useElementSize(scroller);
const tile = computed(() => APP_TILES[props.density]);
const columns = computed(() => gridColumns(width.value, props.density));
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
  } else if (event.key === "Escape" && props.selected) {
    event.preventDefault();
    emit("clear");
  }
}

function onClick(event: MouseEvent, app: AdbPackage) {
  if (event.detail > 1) return;
  emit("select", app);
}

const activeId = computed(() => {
  const name = props.selected;
  const shown = items.value.some((row) => row.data.some((app) => app.packageName === name));
  return name && shown ? optionId(listId, name) : undefined;
});
</script>

<template>
  <div
    ref="scroller"
    class="h-full overflow-y-auto outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
    :style="{ padding: `${GRID_PADDING}px` }"
    tabindex="0"
    role="listbox"
    aria-label="Apps"
    :aria-activedescendant="activeId"
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
      <div
        v-for="app in row.data"
        :id="optionId(listId, app.packageName)"
        :key="app.packageName"
        role="option"
        :aria-selected="app.packageName === props.selected"
        class="m-0.5 flex min-w-0 cursor-default flex-col items-center justify-start gap-2 rounded-well px-2 pt-3"
        :class="rowStateClass(app.packageName === props.selected)"
        :title="app.packageName"
        @click="onClick($event, app)"
        @dblclick="emit('launch', app)"
      >
        <AppIcon
          :serial="props.serial"
          :apk-path="app.apkPath"
          :package-name="app.packageName"
          :icon-path="app.iconPath"
          :label="appDisplayName(app)"
          :size="tile.icon"
          :class="{ 'opacity-50 grayscale': !app.enabled }"
        />
        <span
          class="line-clamp-2 h-8 w-full text-center text-xs leading-4 [overflow-wrap:anywhere] text-foreground"
        >
          {{ appDisplayName(app) }}
        </span>
      </div>
    </div>
    <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
  </div>
</template>
