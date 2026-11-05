<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type Component } from "vue";
import { Eye, EyeOff } from "lucide-vue-next";
import { Button, SearchField } from "@capubridge/cladd";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import { optionId } from "@/shared/list/rowState";
import DataState from "./DataState.vue";
import DataTreeItem from "./DataTreeItem.vue";
import { buildDataTree, isFocusableRow } from "./dataTreeModel";
import type { DataAction, DataSection, DataSelection, DataTreeRow } from "./dataFrame.types";

const ROW_HEIGHT = 28;

/**
 * The sources sidebar every Data tab shares: search, sections, sources and their
 * collections, pins and hidden entries, change marks and a menu per row. One tab stop;
 * arrows move, → opens, ← closes or goes to the parent, Enter opens the row.
 */
const props = defineProps<{
  sections: readonly DataSection[];
  selection: DataSelection | null;
  loading: boolean;
  error: string | null;
  searchLabel: string;
  sourceIcon: Component;
  collectionIcon: Component;
  actionsFor: (row: DataTreeRow) => readonly DataAction[];
}>();

const search = defineModel<string>("search", { required: true });
const showHidden = defineModel<boolean>("showHidden", { required: true });

const emit = defineEmits<{
  select: [sourceId: string, collectionId: string | null];
  toggle: [sourceId: string, expanded: boolean];
  action: [actionId: string, row: DataTreeRow];
  link: [to: string];
  retry: [];
}>();

defineSlots<{ tools?: () => unknown; empty?: () => unknown }>();

const listId = useId();
const scroller = ref<HTMLElement | null>(null);
const activeKey = ref<string | null>(null);
const treeFocused = ref(false);

const tree = computed(() =>
  buildDataTree(props.sections, { search: search.value, showHidden: showHidden.value }),
);
const rows = computed(() => tree.value.rows);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(rows, scroller, {
  itemHeight: ROW_HEIGHT,
  overscan: 8,
});

const hiddenCount = computed(() => tree.value.hiddenSources + tree.value.hiddenCollections);
const hasSources = computed(() => props.sections.some((section) => section.sources.length > 0));

function rowKeyOf(selection: DataSelection | null): string | null {
  if (!selection) return null;
  return selection.collectionId === null
    ? `s:${selection.sourceId}`
    : `c:${selection.sourceId}\u0000${selection.collectionId}`;
}

const selectedKey = computed(() => rowKeyOf(props.selection));
const activeId = computed(() => (activeKey.value ? optionId(listId, activeKey.value) : undefined));

function reveal(key: string) {
  const index = rows.value.findIndex((row) => row.key === key);
  const element = scroller.value;
  if (index < 0 || !element) return;
  const top = index * ROW_HEIGHT;
  if (top < element.scrollTop) element.scrollTop = top;
  else if (top + ROW_HEIGHT > element.scrollTop + element.clientHeight) {
    element.scrollTop = top + ROW_HEIGHT - element.clientHeight;
  }
}

watch(
  selectedKey,
  (key) => {
    if (!key) return;
    activeKey.value = key;
    void nextTick(() => reveal(key));
  },
  { immediate: true },
);

function open(row: DataTreeRow) {
  activeKey.value = row.key;
  if (row.kind === "source") {
    emit("select", row.source.id, null);
    if (!row.source.expanded) emit("toggle", row.source.id, true);
  } else if (row.kind === "collection") {
    emit("select", row.source.id, row.collection.id);
  } else if (row.kind === "link") {
    emit("link", row.link.to);
  }
}

function focusable(): DataTreeRow[] {
  return rows.value.filter(isFocusableRow);
}

function moveTo(row: DataTreeRow | undefined) {
  if (!row) return;
  activeKey.value = row.key;
  reveal(row.key);
}

function onKeydown(event: KeyboardEvent) {
  const list = focusable();
  const index = list.findIndex((row) => row.key === activeKey.value);
  const current = list[index];
  switch (event.key) {
    case "ArrowDown":
      moveTo(list[Math.min(list.length - 1, index + 1)]);
      break;
    case "ArrowUp":
      moveTo(list[Math.max(0, index - 1)]);
      break;
    case "Home":
      moveTo(list[0]);
      break;
    case "End":
      moveTo(list[list.length - 1]);
      break;
    case "ArrowRight":
      if (current?.kind !== "source") return;
      if (!current.source.expanded) emit("toggle", current.source.id, true);
      else moveTo(list[index + 1]);
      break;
    case "ArrowLeft":
      if (current?.kind === "source" && current.source.expanded) {
        emit("toggle", current.source.id, false);
      } else if (current && (current.kind === "collection" || current.kind === "link")) {
        const parentId = current.source.id;
        moveTo(list.find((row) => row.kind === "source" && row.source.id === parentId));
      } else return;
      break;
    case "Enter":
    case " ":
      if (current) open(current);
      break;
    default:
      return;
  }
  event.preventDefault();
}

function onFocus() {
  treeFocused.value = true;
  if (activeKey.value && rows.value.some((row) => row.key === activeKey.value)) return;
  activeKey.value = focusable()[0]?.key ?? null;
}
</script>

<template>
  <aside class="flex h-full min-h-0 flex-col" :aria-label="searchLabel">
    <div class="flex shrink-0 items-center gap-1 px-2 pt-2 pb-1.5">
      <SearchField
        v-model="search"
        size="sm"
        class="min-w-0 flex-1"
        :placeholder="searchLabel"
        :aria-label="searchLabel"
      />
      <slot name="tools" />
    </div>

    <DataState v-if="loading && !hasSources" kind="loading" compact title="Reading databases" />
    <DataState
      v-else-if="error && !hasSources"
      kind="error"
      compact
      title="Could not list the databases"
      :detail="error"
      @retry="emit('retry')"
    />
    <div v-else-if="!hasSources" class="flex flex-1 flex-col px-3 py-4">
      <slot name="empty" />
    </div>
    <template v-else>
      <p v-if="tree.noMatch" class="px-4 py-3 text-xs text-muted-foreground">
        Nothing is named “{{ search }}”.
      </p>
      <div
        ref="scroller"
        role="tree"
        tabindex="0"
        :aria-label="searchLabel"
        :aria-activedescendant="activeId"
        class="min-h-0 flex-1 overflow-y-auto pb-2 outline-none"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="treeFocused = false"
      >
        <div :style="{ height: `${topSpacerHeight}px` }" />
        <DataTreeItem
          v-for="item in items"
          :id="optionId(listId, item.data.key)"
          :key="item.data.key"
          :row="item.data"
          :selected="item.data.key === selectedKey"
          :active="treeFocused && item.data.key === activeKey && item.data.key !== selectedKey"
          :actions="
            item.data.kind === 'source' || item.data.kind === 'collection'
              ? actionsFor(item.data)
              : []
          "
          :source-icon="sourceIcon"
          :collection-icon="collectionIcon"
          @select="open(item.data)"
          @toggle="
            item.data.kind === 'source' &&
            emit('toggle', item.data.source.id, !item.data.source.expanded)
          "
          @action="emit('action', $event, item.data)"
          @link="emit('link', $event)"
        />
        <div :style="{ height: `${bottomSpacerHeight}px` }" />
      </div>
    </template>

    <div
      v-if="hiddenCount > 0"
      class="flex shrink-0 items-center justify-between gap-2 border-t border-border-subtle px-3 py-1"
    >
      <span class="text-2xs text-[var(--fg-subtle)]">{{ hiddenCount }} hidden</span>
      <Button
        size="2xs"
        variant="transparent"
        :outline="false"
        content-class-name="gap-1"
        @click="showHidden = !showHidden"
      >
        <component :is="showHidden ? EyeOff : Eye" :size="11" aria-hidden="true" />
        {{ showHidden ? "Hide them" : "Show them" }}
      </Button>
    </div>
  </aside>
</template>
