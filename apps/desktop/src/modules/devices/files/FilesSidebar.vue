<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight, Folder, FolderOpen } from "lucide-vue-next";
import { Spinner } from "@capubridge/cladd";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import { FILE_PLACES, TREE_ROW_HEIGHT } from "./filesView";
import type { TreeRow } from "./useFileTree";

const props = defineProps<{
  rows: readonly TreeRow[];
  dir: string;
}>();

const emit = defineEmits<{ open: [path: string]; toggle: [path: string] }>();

const scroller = ref<HTMLElement | null>(null);
const treeRows = computed(() => props.rows);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(treeRows, scroller, {
  itemHeight: TREE_ROW_HEIGHT,
  overscan: 10,
});

function isAncestor(path: string): boolean {
  return path === "/" ? props.dir !== "/" : props.dir.startsWith(`${path}/`);
}
</script>

<template>
  <nav class="flex h-full min-h-0 flex-col" aria-label="Folders on the phone">
    <ul class="flex flex-col gap-px border-b border-border-subtle p-1.5">
      <li v-for="place in FILE_PLACES" :key="place.key">
        <button
          type="button"
          class="flex h-7 w-full items-center gap-2 rounded-control px-2 text-left text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :class="
            props.dir === place.path
              ? 'bg-cladd-surface-next text-foreground shadow-bevel'
              : 'text-muted-foreground hover:bg-cladd-surface-hover hover:text-foreground'
          "
          :title="place.path"
          @click="emit('open', place.path)"
        >
          <Folder :size="14" :stroke-width="1.6" class="shrink-0" aria-hidden="true" />
          <span class="truncate">{{ place.label }}</span>
        </button>
      </li>
    </ul>
    <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto py-1.5">
      <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
      <div
        v-for="item in items"
        :key="item.data.path"
        class="mx-1.5 flex items-center gap-1 rounded-control pr-2 text-xs"
        :class="
          item.data.path === props.dir
            ? 'bg-cladd-surface-next text-foreground shadow-bevel'
            : isAncestor(item.data.path)
              ? 'text-foreground hover:bg-cladd-surface-hover'
              : 'text-muted-foreground hover:bg-cladd-surface-hover hover:text-foreground'
        "
        :style="{ height: `${TREE_ROW_HEIGHT}px`, paddingLeft: `${4 + item.data.depth * 12}px` }"
      >
        <button
          type="button"
          class="grid size-5 shrink-0 place-items-center rounded-inner text-[var(--fg-subtle)] hover:text-foreground"
          :aria-label="
            item.data.expanded ? `Collapse ${item.data.label}` : `Expand ${item.data.label}`
          "
          :aria-expanded="item.data.expanded"
          @click="emit('toggle', item.data.path)"
        >
          <Spinner v-if="item.data.loading" size="xs" />
          <ChevronRight
            v-else
            :size="12"
            class="transition-transform duration-120"
            :class="item.data.expanded && 'rotate-90'"
          />
        </button>
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none focus-visible:underline"
          :title="item.data.path"
          @click="emit('open', item.data.path)"
        >
          <component
            :is="item.data.expanded ? FolderOpen : Folder"
            :size="14"
            :stroke-width="1.6"
            class="shrink-0"
            aria-hidden="true"
          />
          <span class="truncate">{{ item.data.label }}</span>
        </button>
      </div>
      <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
    </div>
  </nav>
</template>
