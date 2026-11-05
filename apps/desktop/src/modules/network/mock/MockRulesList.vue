<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { Trash2 } from "lucide-vue-next";
import { Switch } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import { scrollTopToReveal } from "@/shared/list/grid";
import { optionId, rowStateClass } from "@/shared/list/rowState";
import type { MockRule } from "@/types/mock.types";
import { TONE_CLASS, statusTone } from "../requests/requestCells";

const ROW_HEIGHT = 44;

const props = defineProps<{ rules: readonly MockRule[]; selectedId: string | null }>();

const emit = defineEmits<{
  select: [id: string];
  clear: [];
  toggle: [id: string, enabled: boolean];
  remove: [id: string];
}>();

const listId = useId();
const scroller = ref<HTMLElement | null>(null);
const source = computed(() => props.rules);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(source, scroller, {
  itemHeight: ROW_HEIGHT,
  overscan: 8,
});

const rows = computed(() =>
  items.value.map(({ data: rule }) => ({
    rule,
    id: optionId(listId, rule.id),
    selected: rule.id === props.selectedId,
    statusClass: TONE_CLASS[statusTone(rule.statusCode)],
  })),
);
const activeId = computed(() => rows.value.find((row) => row.selected)?.id);

function reveal(index: number) {
  const element = scroller.value;
  if (!element || index < 0) return;
  element.scrollTop = scrollTopToReveal(index, ROW_HEIGHT, element.scrollTop, element.clientHeight);
}

function move(step: number) {
  const list = props.rules;
  if (!list.length) return;
  const current = list.findIndex((rule) => rule.id === props.selectedId);
  const next = Math.min(list.length - 1, Math.max(0, current < 0 ? 0 : current + step));
  const rule = list[next];
  if (!rule) return;
  emit("select", rule.id);
  reveal(next);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    move(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    move(event.key === "Home" ? -Infinity : Infinity);
  } else if (event.key === " " && props.selectedId) {
    event.preventDefault();
    const rule = props.rules.find((candidate) => candidate.id === props.selectedId);
    if (rule) emit("toggle", rule.id, !rule.enabled);
  } else if (event.key === "Escape" && props.selectedId) {
    event.preventDefault();
    emit("clear");
  }
}

watch(
  () => props.selectedId,
  (id) => reveal(props.rules.findIndex((rule) => rule.id === id)),
  { flush: "post" },
);
</script>

<template>
  <div
    ref="scroller"
    class="min-h-0 flex-1 overflow-y-auto py-1 outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
    tabindex="0"
    role="listbox"
    aria-label="Mock rules"
    :aria-activedescendant="activeId"
    @keydown="onKeydown"
  >
    <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
    <div
      v-for="row in rows"
      :id="row.id"
      :key="row.rule.id"
      role="option"
      :aria-selected="row.selected"
      class="group/row mx-1.5 flex cursor-default items-center gap-2.5 rounded-control px-2.5"
      :class="rowStateClass(row.selected)"
      :style="{ height: `${ROW_HEIGHT}px` }"
      @click="emit('select', row.rule.id)"
    >
      <span class="flex shrink-0" @click.stop>
        <Switch
          size="sm"
          :model-value="row.rule.enabled"
          :focusable="false"
          :aria-label="row.rule.enabled ? `Turn off ${row.rule.name}` : `Turn on ${row.rule.name}`"
          @update:model-value="emit('toggle', row.rule.id, $event === true)"
        />
      </span>
      <span class="flex min-w-0 flex-1 flex-col" :class="!row.rule.enabled && 'opacity-55'">
        <span class="flex min-w-0 items-baseline gap-2">
          <span class="shrink-0 font-mono text-2xs text-muted-foreground">{{
            row.rule.method
          }}</span>
          <span class="truncate text-xs text-foreground">{{ row.rule.name }}</span>
        </span>
        <span class="truncate font-mono text-2xs text-[var(--fg-subtle)]">
          {{ row.rule.urlPattern || "Every address" }}
        </span>
      </span>
      <span class="flex shrink-0 flex-col items-end">
        <span class="font-mono text-2xs tabular-nums" :class="row.statusClass">
          {{ row.rule.statusCode }}
        </span>
        <span
          v-if="row.rule.hitCount > 0"
          class="font-mono text-2xs text-[var(--fg-subtle)] tabular-nums"
          :title="`Answered ${row.rule.hitCount} ${row.rule.hitCount === 1 ? 'request' : 'requests'}`"
        >
          {{ row.rule.hitCount }}×
        </span>
      </span>
      <IconAction
        label="Delete rule"
        size="sm"
        tabindex="-1"
        class="opacity-0 transition-opacity duration-120 group-hover/row:opacity-100"
        :class="row.selected && 'opacity-100'"
        @click.stop="emit('remove', row.rule.id)"
      >
        <Trash2 :stroke-width="1.8" />
      </IconAction>
    </div>
    <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
  </div>
</template>
