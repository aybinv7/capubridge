<script setup lang="ts">
import { computed, type Component } from "vue";
import { ArrowUpRight, ChevronRight } from "lucide-vue-next";
import { StatusDot } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { rowStateClass } from "@/shared/list/rowState";
import ChangeStripe from "./ChangeStripe.vue";
import DataRowMenu from "./DataRowMenu.vue";
import type { DataAction, DataTreeRow } from "./dataFrame.types";

/** One line of the sources tree: a heading, a source, one of its collections, a link or a note. */
const props = defineProps<{
  row: DataTreeRow;
  id: string;
  selected: boolean;
  active: boolean;
  actions: readonly DataAction[];
  sourceIcon: Component;
  collectionIcon: Component;
}>();

const menuOpen = defineModel<boolean>("menuOpen", { default: false });

const emit = defineEmits<{
  select: [];
  keep: [];
  toggle: [];
  action: [actionId: string];
  link: [to: string];
}>();

const changes = computed(() => {
  if (props.row.kind === "source") return props.row.source.changes;
  if (props.row.kind === "collection") return props.row.collection.changes;
  return undefined;
});

const depth = computed(() =>
  props.row.kind === "collection" ? (props.row.collection.depth ?? 0) : 0,
);

const menuLabel = computed(() => {
  if (props.row.kind === "source") return `Actions for ${props.row.source.label}`;
  if (props.row.kind === "collection") return `Actions for ${props.row.collection.label}`;
  return "Actions";
});
</script>

<template>
  <div
    v-if="row.kind === 'section'"
    class="flex h-7 items-end px-3 pb-1 text-2xs font-medium text-[var(--fg-subtle)]"
    role="presentation"
  >
    {{ row.section.label }}
  </div>

  <div
    v-else-if="row.kind === 'note'"
    class="flex h-7 items-center px-3 pl-8 text-2xs text-[var(--fg-subtle)]"
    role="presentation"
  >
    {{ row.text }}
  </div>

  <div
    v-else-if="row.kind === 'link'"
    :id="id"
    role="treeitem"
    :aria-selected="false"
    class="mx-1.5 flex h-7 cursor-default items-center gap-1.5 rounded-control pr-2 pl-8 text-2xs text-muted-foreground"
    :class="[active ? 'ring-1 ring-ring ring-inset' : '', rowStateClass(false)]"
    @click="emit('link', row.link.to)"
  >
    <span class="truncate">{{ row.link.label }}</span>
    <ArrowUpRight :size="12" class="shrink-0" aria-hidden="true" />
  </div>

  <div
    v-else
    :id="id"
    role="treeitem"
    :aria-level="row.kind === 'source' ? 1 : 2 + depth"
    :aria-selected="selected"
    :aria-expanded="row.kind === 'source' ? row.source.expanded : undefined"
    class="group/row relative mx-1.5 flex h-7 cursor-default items-center gap-1.5 rounded-control pr-1 text-xs"
    :class="[
      rowStateClass(selected),
      active && !selected ? 'ring-1 ring-ring ring-inset' : '',
      row.kind === 'source' ? 'pl-1' : 'pl-7',
    ]"
    :style="depth > 0 ? { paddingLeft: `${28 + depth * 12}px` } : undefined"
    @click="emit('select')"
    @dblclick="emit('keep')"
    @contextmenu.prevent="actions.length > 0 && (menuOpen = true)"
  >
    <ChangeStripe v-if="changes && changes.total > 0" :changes="changes" />
    <button
      v-if="row.kind === 'source'"
      type="button"
      tabindex="-1"
      class="flex size-5 shrink-0 items-center justify-center rounded-inner text-[var(--fg-subtle)] hover:text-foreground"
      :aria-label="
        row.source.expanded ? `Collapse ${row.source.label}` : `Expand ${row.source.label}`
      "
      @click.stop="emit('toggle')"
    >
      <ChevronRight
        :size="12"
        class="transition-transform duration-120"
        :class="row.source.expanded && 'rotate-90'"
        aria-hidden="true"
      />
    </button>
    <component
      :is="row.kind === 'source' ? sourceIcon : collectionIcon"
      :size="13"
      :stroke-width="1.8"
      class="shrink-0 text-[var(--fg-subtle)]"
      aria-hidden="true"
    />
    <span
      class="min-w-0 flex-auto truncate"
      :class="[
        selected ? 'text-foreground' : 'text-foreground/85',
        (row.kind === 'source' ? row.source.hidden : row.collection.hidden) && 'opacity-50',
      ]"
    >
      {{ row.kind === "source" ? row.source.label : row.collection.label }}
    </span>
    <HintTooltip
      v-if="row.kind === 'collection' && row.collection.watched === false"
      text="Not watched for changes. Watch it from the store's header."
    >
      <StatusDot variant="hollow" size="xs" aria-label="Not watched" />
    </HintTooltip>
    <span
      v-if="row.kind === 'collection' && row.collection.pinned"
      class="size-1.5 shrink-0 rounded-full bg-[var(--fg-subtle)]"
      role="img"
      aria-label="Pinned"
    />
    <span
      v-if="row.kind === 'source' && row.source.detail"
      class="min-w-0 shrink-[100] truncate font-mono text-2xs text-[var(--fg-subtle)] tabular-nums"
    >
      {{ row.source.detail }}
    </span>
    <span
      v-else-if="row.kind === 'collection' && row.collection.count !== undefined"
      class="shrink-0 font-mono text-2xs text-[var(--fg-subtle)] tabular-nums group-hover/row:hidden"
    >
      {{ row.collection.count.toLocaleString("en-US") }}
    </span>
    <span
      v-if="actions.length > 0"
      class="flex shrink-0 opacity-0 transition-opacity duration-120 group-hover/row:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100"
      :class="(selected || menuOpen) && 'opacity-100'"
    >
      <DataRowMenu
        v-model:open="menuOpen"
        :actions="actions"
        :label="menuLabel"
        in-list
        @select="emit('action', $event)"
      />
    </span>
  </div>
</template>
