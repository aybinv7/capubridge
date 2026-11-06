<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { Trash2 } from "lucide-vue-next";
import { Switch } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import { scrollTopToReveal } from "@/shared/list/grid";
import { optionId, rowStateClass } from "@/shared/list/rowState";
import type { MockRule } from "@/types/mock.types";
import ListHeader from "../columns/ListHeader.vue";
import TruncateStart from "../columns/TruncateStart.vue";
import type { ListColumnsLayout } from "../columns/useListColumns";
import { TONE_CLASS, statusTone } from "../requests/requestCells";
import { methodTone } from "../requests/requestRowCells";
import {
  MOCK_ROW_HEIGHT,
  delayText,
  hitsText,
  matchText,
  type MockRuleColumnId,
} from "./mockColumns";

const props = defineProps<{
  rules: readonly MockRule[];
  selectedId: string | null;
  hits: (id: string) => number;
  layout: ListColumnsLayout<MockRuleColumnId>;
}>();

const emit = defineEmits<{
  select: [id: string];
  clear: [];
  toggle: [id: string, enabled: boolean];
  remove: [id: string];
}>();

const listId = useId();
const header = ref<{ root: HTMLElement | null } | null>(null);
const headerElement = computed(() => header.value?.root ?? null);
const columns = computed(() => props.layout.shown.value);
const scroller = ref<HTMLElement | null>(null);
const source = computed(() => props.rules);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(source, scroller, {
  itemHeight: MOCK_ROW_HEIGHT,
  overscan: 8,
});

const rows = computed(() =>
  items.value.map(({ data: rule }) => {
    const hits = props.hits(rule.id);
    return {
      rule,
      id: optionId(listId, rule.id),
      selected: rule.id === props.selectedId,
      hits,
      hitsText: hitsText(hits),
      match: matchText(rule),
      delay: delayText(rule.delayMs),
      methodClass: TONE_CLASS[methodTone(rule.method)],
      statusClass: TONE_CLASS[statusTone(rule.statusCode)],
    };
  }),
);
const activeId = computed(() => rows.value.find((row) => row.selected)?.id);

function reveal(index: number) {
  const element = scroller.value;
  if (!element || index < 0) return;
  element.scrollTop = scrollTopToReveal(
    index,
    MOCK_ROW_HEIGHT,
    element.scrollTop,
    element.clientHeight,
  );
}

function move(step: number) {
  const list = props.rules;
  if (!list.length) return;
  const current = list.findIndex((rule) => rule.id === props.selectedId);
  const start = current < 0 ? (step > 0 ? -1 : list.length) : current;
  const next = Math.min(list.length - 1, Math.max(0, start + step));
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
  { flush: "post", immediate: true },
);

defineExpose({ header: headerElement });
</script>

<template>
  <div class="flex h-full min-h-0 flex-col" :style="{ '--list-cols': props.layout.template.value }">
    <ListHeader
      ref="header"
      :columns="columns"
      :edge-of="props.layout.edgeOf"
      :resizing="props.layout.resizing.value"
      @resize-start="props.layout.startResize"
      @reset-width="props.layout.resetWidth"
    />
    <div
      ref="scroller"
      class="min-h-0 flex-1 overflow-y-auto py-1 outline-none [scrollbar-gutter:stable] focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
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
        class="group/row mx-1.5 grid cursor-default items-center rounded-control px-0.5 text-xs leading-4 whitespace-nowrap [grid-template-columns:var(--list-cols)]"
        :class="rowStateClass(row.selected)"
        :style="{ height: `${MOCK_ROW_HEIGHT}px` }"
        @click="emit('select', row.rule.id)"
      >
        <span
          v-for="column in columns"
          :key="column.id"
          class="flex min-w-0 items-center px-2"
          :class="[
            column.align === 'end' && 'justify-end',
            !row.rule.enabled && column.id !== 'enabled' && column.id !== 'actions' && 'opacity-55',
          ]"
        >
          <span v-if="column.id === 'enabled'" class="flex" @click.stop>
            <Switch
              size="sm"
              :model-value="row.rule.enabled"
              :focusable="false"
              :aria-label="
                row.rule.enabled ? `Turn off ${row.rule.name}` : `Turn on ${row.rule.name}`
              "
              @update:model-value="emit('toggle', row.rule.id, $event === true)"
            />
          </span>
          <span
            v-else-if="column.id === 'method'"
            class="truncate font-mono"
            :class="row.methodClass"
          >
            {{ row.rule.method }}
          </span>
          <span
            v-else-if="column.id === 'name'"
            class="truncate text-foreground"
            :title="row.rule.name"
          >
            {{ row.rule.name }}
          </span>
          <TruncateStart
            v-else-if="column.id === 'match'"
            :text="row.match.text"
            :title="row.match.every ? undefined : row.match.text"
            :class="row.match.every ? 'text-[var(--fg-subtle)]' : 'font-mono text-muted-foreground'"
          />
          <span
            v-else-if="column.id === 'status'"
            class="truncate font-mono tabular-nums"
            :class="row.statusClass"
          >
            {{ row.rule.statusCode }}
          </span>
          <span
            v-else-if="column.id === 'delay'"
            class="truncate font-mono text-[var(--fg-subtle)] tabular-nums"
          >
            {{ row.delay }}
          </span>
          <HintTooltip
            v-else-if="column.id === 'hits' && row.hits > 0"
            :text="`Matched ${row.hits} ${row.hits === 1 ? 'request' : 'requests'} since Capubridge started`"
          >
            <span class="truncate font-mono text-muted-foreground tabular-nums">
              {{ row.hitsText }}
            </span>
          </HintTooltip>
          <span
            v-else-if="column.id === 'hits'"
            class="truncate font-mono text-[var(--fg-subtle)] tabular-nums"
          >
            {{ row.hitsText }}
          </span>
          <IconAction
            v-else-if="column.id === 'actions'"
            label="Delete rule"
            size="xs"
            tabindex="-1"
            class="opacity-0 transition-opacity duration-120 group-hover/row:opacity-100"
            :class="row.selected && 'opacity-100'"
            @click.stop="emit('remove', row.rule.id)"
          >
            <Trash2 :stroke-width="1.8" />
          </IconAction>
        </span>
      </div>
      <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
    </div>
  </div>
</template>
