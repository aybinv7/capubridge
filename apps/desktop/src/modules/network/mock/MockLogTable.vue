<script setup lang="ts">
import { computed, ref } from "vue";
import { StatusDot, type Color } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import type { MockLogEntry } from "@/types/mock.types";
import ListHeader from "../columns/ListHeader.vue";
import TruncateStart from "../columns/TruncateStart.vue";
import type { ListColumnsLayout } from "../columns/useListColumns";
import { TONE_CLASS, statusTone } from "../requests/requestCells";
import { methodTone } from "../requests/requestRowCells";
import { MOCK_ROW_HEIGHT, delayText, type MockLogColumnId } from "./mockColumns";
import { OUTCOME_WORDS, clockTime, logOutcome, type LogOutcome } from "./mockView";

const props = defineProps<{
  entries: readonly MockLogEntry[];
  layout: ListColumnsLayout<MockLogColumnId>;
}>();

const emit = defineEmits<{ openRule: [id: string] }>();

const OUTCOME_DOT: Record<LogOutcome, { color: Color | undefined; solid: boolean }> = {
  mocked: { color: "cyan", solid: true },
  passed: { color: undefined, solid: true },
  unmatched: { color: undefined, solid: false },
};

const header = ref<{ root: HTMLElement | null } | null>(null);
const headerElement = computed(() => header.value?.root ?? null);
const columns = computed(() => props.layout.shown.value);
const scroller = ref<HTMLElement | null>(null);
const source = computed(() => props.entries);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(source, scroller, {
  itemHeight: MOCK_ROW_HEIGHT,
  overscan: 8,
});

const rows = computed(() =>
  items.value.map(({ data: entry }) => {
    const outcome = logOutcome(entry);
    const method = entry.method.toUpperCase();
    return {
      entry,
      method,
      dot: OUTCOME_DOT[outcome],
      word:
        outcome === "mocked" && entry.matchedRuleName
          ? entry.matchedRuleName
          : OUTCOME_WORDS[outcome],
      time: clockTime(entry.timestamp),
      delay: delayText(entry.delayApplied),
      methodClass: TONE_CLASS[methodTone(method)],
      statusClass:
        entry.responseStatus === null
          ? TONE_CLASS.subtle
          : TONE_CLASS[statusTone(entry.responseStatus)],
    };
  }),
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
      class="min-h-0 flex-1 overflow-y-auto py-1 [scrollbar-gutter:stable]"
      role="list"
      aria-label="Intercepted requests"
    >
      <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
      <div
        v-for="row in rows"
        :key="row.entry.id"
        role="listitem"
        class="mx-1.5"
        :style="{ height: `${MOCK_ROW_HEIGHT}px` }"
      >
        <component
          :is="row.entry.matchedRuleId ? 'button' : 'div'"
          :type="row.entry.matchedRuleId ? 'button' : undefined"
          :aria-label="
            row.entry.matchedRuleId ? `Open the rule ${row.entry.matchedRuleName ?? ''}` : undefined
          "
          class="grid h-full w-full items-center rounded-control px-0.5 text-left text-xs leading-4 whitespace-nowrap outline-none [grid-template-columns:var(--list-cols)] focus-visible:ring-1 focus-visible:ring-ring"
          :class="row.entry.matchedRuleId && 'cursor-pointer hover:bg-cladd-surface-hover'"
          @click="row.entry.matchedRuleId && emit('openRule', row.entry.matchedRuleId)"
        >
          <span
            v-for="column in columns"
            :key="column.id"
            class="flex min-w-0 items-center px-2"
            :class="column.align === 'end' && 'justify-end'"
          >
            <span
              v-if="column.id === 'time'"
              class="truncate font-mono text-[var(--fg-subtle)] tabular-nums"
            >
              {{ row.time }}
            </span>
            <span
              v-else-if="column.id === 'method'"
              class="truncate font-mono"
              :class="row.methodClass"
            >
              {{ row.method }}
            </span>
            <span
              v-else-if="column.id === 'status'"
              class="truncate font-mono tabular-nums"
              :class="row.statusClass"
            >
              {{ row.entry.responseStatus ?? "—" }}
            </span>
            <HintTooltip v-else-if="column.id === 'url'" :text="row.entry.url">
              <TruncateStart :text="row.entry.url" class="font-mono text-foreground" />
            </HintTooltip>
            <span v-else-if="column.id === 'rule'" class="flex min-w-0 items-center gap-2">
              <StatusDot
                :color="row.dot.color"
                :variant="row.dot.solid ? 'solid' : 'hollow'"
                size="xs"
              />
              <span class="truncate text-muted-foreground" :title="row.word">{{ row.word }}</span>
            </span>
            <span
              v-else-if="column.id === 'delay'"
              class="truncate font-mono text-[var(--fg-subtle)] tabular-nums"
            >
              {{ row.delay }}
            </span>
          </span>
        </component>
      </div>
      <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
    </div>
  </div>
</template>
