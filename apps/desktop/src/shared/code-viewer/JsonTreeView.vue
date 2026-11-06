<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Copy } from "lucide-vue-next";
import { toast } from "@/lib/toast";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import ViewerToolbar from "./ViewerToolbar.vue";
import { ROOT_ID, expandedToDepth, jsonRows, type JsonRow, type JsonValueKind } from "./jsonTree";

const ROW_HEIGHT = 22;
const OPEN_DEPTH = 2;
const INDENT_PX = 16;

const props = defineProps<{ value: unknown }>();

const expanded = shallowRef<Set<string>>(expandedToDepth(props.value, OPEN_DEPTH));
const scroller = ref<HTMLElement | null>(null);

watch(
  () => props.value,
  (value) => {
    expanded.value = expandedToDepth(value, OPEN_DEPTH);
  },
);

const rows = computed(() => jsonRows(props.value, expanded.value));
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(rows, scroller, {
  itemHeight: ROW_HEIGHT,
  overscan: 16,
});

const VALUE_CLASS: Record<JsonValueKind, string> = {
  string: "text-success",
  number: "text-cat-console",
  boolean: "text-cat-console",
  null: "text-[var(--fg-subtle)]",
  object: "text-muted-foreground",
  array: "text-muted-foreground",
};

function toggle(row: JsonRow) {
  if (!row.expandable) return;
  const next = new Set(expanded.value);
  if (next.has(row.id)) next.delete(row.id);
  else next.add(row.id);
  expanded.value = next;
}

async function copyAll() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(props.value, null, 2));
    toast.success("Copied as JSON");
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}

function collapseAll() {
  expanded.value = new Set([ROOT_ID]);
}

function expandLevels() {
  expanded.value = expandedToDepth(props.value, OPEN_DEPTH + 2);
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <ViewerToolbar>
      <template #start>
        <slot name="lead" />
        <span class="font-mono text-2xs tabular-nums"
          >{{ rows.length.toLocaleString("en-US") }} rows open</span
        >
      </template>
      <template #end>
        <IconAction label="Copy as JSON" @click="copyAll">
          <Copy :stroke-width="1.8" />
        </IconAction>
        <IconAction label="Open four levels" @click="expandLevels">
          <ChevronsUpDown :stroke-width="1.8" />
        </IconAction>
        <IconAction label="Collapse all" @click="collapseAll">
          <ChevronsDownUp :stroke-width="1.8" />
        </IconAction>
      </template>
    </ViewerToolbar>
    <div
      ref="scroller"
      class="min-h-0 flex-1 overflow-auto bg-surface-cut py-1 font-mono text-xs select-text"
      role="tree"
      aria-label="JSON tree"
    >
      <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
      <div
        v-for="item in items"
        :key="item.data.id"
        role="treeitem"
        :aria-level="item.data.depth + 1"
        :aria-expanded="item.data.expandable ? item.data.expanded : undefined"
        class="flex items-center gap-1 pr-4 whitespace-pre hover:bg-cladd-surface-hover"
        :class="item.data.expandable && 'cursor-pointer'"
        :style="{ height: `${ROW_HEIGHT}px`, paddingLeft: `${item.data.depth * INDENT_PX + 8}px` }"
        @click="toggle(item.data)"
      >
        <button
          v-if="item.data.expandable"
          type="button"
          class="grid size-4 shrink-0 place-items-center rounded-inner text-[var(--fg-subtle)] hover:text-foreground"
          :aria-label="item.data.expanded ? 'Collapse' : 'Expand'"
          @click.stop="toggle(item.data)"
        >
          <ChevronRight
            :size="12"
            :stroke-width="2"
            class="transition-transform duration-120 ease-cladd-settle motion-reduce:transition-none"
            :class="item.data.expanded && 'rotate-90'"
          />
        </button>
        <span v-else class="size-4 shrink-0" aria-hidden="true" />
        <template v-if="item.data.key !== null">
          <span class="text-cat-network">{{ item.data.key }}</span>
          <span class="text-[var(--fg-subtle)]">:</span>
        </template>
        <span class="truncate" :class="VALUE_CLASS[item.data.kind]">{{ item.data.preview }}</span>
      </div>
      <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
    </div>
  </div>
</template>
