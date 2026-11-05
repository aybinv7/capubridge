<script setup lang="ts">
import { computed, ref } from "vue";
import { StatusDot, type Color } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";
import type { MockLogEntry } from "@/types/mock.types";
import { TONE_CLASS, statusTone } from "../requests/requestCells";
import { OUTCOME_WORDS, clockTime, logOutcome, type LogOutcome } from "./mockView";

const ROW_HEIGHT = 40;

const props = defineProps<{ entries: readonly MockLogEntry[] }>();

const emit = defineEmits<{ openRule: [id: string] }>();

const OUTCOME_DOT: Record<LogOutcome, { color: Color | undefined; solid: boolean }> = {
  mocked: { color: "cyan", solid: true },
  passed: { color: undefined, solid: true },
  unmatched: { color: undefined, solid: false },
};

const scroller = ref<HTMLElement | null>(null);
const source = computed(() => props.entries);
const { items, topSpacerHeight, bottomSpacerHeight } = useFixedVirtualList(source, scroller, {
  itemHeight: ROW_HEIGHT,
  overscan: 8,
});

const rows = computed(() =>
  items.value.map(({ data: entry }) => {
    const outcome = logOutcome(entry);
    return {
      entry,
      outcome,
      dot: OUTCOME_DOT[outcome],
      word:
        outcome === "mocked" && entry.matchedRuleName
          ? entry.matchedRuleName
          : OUTCOME_WORDS[outcome],
      time: clockTime(entry.timestamp),
      statusClass:
        entry.responseStatus === null ? "" : TONE_CLASS[statusTone(entry.responseStatus)],
    };
  }),
);
</script>

<template>
  <div
    ref="scroller"
    class="min-h-0 flex-1 overflow-y-auto py-1"
    role="list"
    aria-label="Intercepted requests"
  >
    <div :style="{ height: `${topSpacerHeight}px` }" aria-hidden="true" />
    <div
      v-for="row in rows"
      :key="row.entry.id"
      role="listitem"
      class="mx-1.5"
      :style="{ height: `${ROW_HEIGHT}px` }"
    >
      <component
        :is="row.entry.matchedRuleId ? 'button' : 'div'"
        :type="row.entry.matchedRuleId ? 'button' : undefined"
        :aria-label="
          row.entry.matchedRuleId ? `Open the rule ${row.entry.matchedRuleName ?? ''}` : undefined
        "
        class="flex h-full w-full items-center gap-2.5 rounded-control px-2.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
        :class="row.entry.matchedRuleId && 'cursor-pointer hover:bg-cladd-surface-hover'"
        @click="row.entry.matchedRuleId && emit('openRule', row.entry.matchedRuleId)"
      >
        <StatusDot :color="row.dot.color" :variant="row.dot.solid ? 'solid' : 'hollow'" size="xs" />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="flex min-w-0 items-baseline gap-2">
            <span class="shrink-0 font-mono text-2xs text-muted-foreground">{{
              row.entry.method
            }}</span>
            <HintTooltip :text="row.entry.url">
              <span class="truncate font-mono text-2xs text-foreground">{{ row.entry.url }}</span>
            </HintTooltip>
          </span>
          <span class="truncate text-2xs text-[var(--fg-subtle)]">
            {{ row.word }}
            <template v-if="row.entry.delayApplied > 0">
              · after {{ row.entry.delayApplied }} ms</template
            >
          </span>
        </span>
        <span class="flex shrink-0 flex-col items-end">
          <span class="font-mono text-2xs tabular-nums" :class="row.statusClass">
            {{ row.entry.responseStatus ?? "—" }}
          </span>
          <span class="font-mono text-2xs text-[var(--fg-subtle)] tabular-nums">{{
            row.time
          }}</span>
        </span>
      </component>
    </div>
    <div :style="{ height: `${bottomSpacerHeight}px` }" aria-hidden="true" />
  </div>
</template>
