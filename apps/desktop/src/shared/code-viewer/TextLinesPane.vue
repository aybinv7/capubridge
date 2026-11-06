<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { logLevel, type LogLevel } from "./logLevels";
import { longestLine } from "./textLines";
import {
  MAX_RENDERED_LINE,
  renderedSegments,
  type CodeToken,
  type MarkRange,
} from "./textSegments";
import type { TextLanguage } from "./codeLanguage";

const ROW_HEIGHT = 20;

const props = defineProps<{
  lines: readonly string[];
  tokens: readonly CodeToken[][];
  language: TextLanguage;
  wrap: boolean;
  rangesFor: (line: number) => readonly MarkRange[];
}>();

const LEVEL_CLASS: Record<LogLevel, string> = {
  error: "text-error",
  warn: "text-warning",
  info: "text-foreground",
  debug: "text-[var(--fg-subtle)]",
};

const scroller = ref<HTMLElement | null>(null);
const gutterChars = computed(() => String(props.lines.length).length + 2);
const contentMinWidth = computed(() =>
  props.wrap
    ? "100%"
    : `calc(${Math.min(longestLine(props.lines), MAX_RENDERED_LINE + 32) + gutterChars.value + 4}ch)`,
);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.lines.length,
    getScrollElement: () => scroller.value,
    estimateSize: () => ROW_HEIGHT,
    overscan: 24,
  })),
);
const rows = computed(() => virtualizer.value.getVirtualItems());

watch(
  () => [props.wrap, props.lines] as const,
  () => {
    void nextTick(() => virtualizer.value.measure());
  },
);

function measure(element: unknown) {
  if (props.wrap && element instanceof Element) virtualizer.value.measureElement(element);
}

function segmentsFor(index: number) {
  return renderedSegments(props.lines[index] ?? "", props.tokens[index], props.rangesFor(index));
}

function lineClass(index: number): string {
  if (props.language !== "log") return "text-foreground";
  const level = logLevel(props.lines[index] ?? "");
  return level ? LEVEL_CLASS[level] : "text-foreground";
}

/** Brings line `index` to the middle of the view, for find. */
function revealLine(index: number) {
  virtualizer.value.scrollToIndex(index, { align: "center" });
}

function focus() {
  scroller.value?.focus({ preventScroll: true });
}

defineExpose({ revealLine, focus });
</script>

<template>
  <div
    ref="scroller"
    class="code-tokens h-full overflow-auto bg-surface-cut font-mono text-xs leading-5 select-text"
    tabindex="0"
    role="document"
  >
    <div
      class="relative"
      :style="{ height: `${virtualizer.getTotalSize()}px`, minWidth: contentMinWidth }"
    >
      <div
        v-for="row in rows"
        :key="row.index"
        :ref="measure"
        :data-index="row.index"
        class="absolute top-0 left-0 flex w-full"
        :style="{
          transform: `translateY(${row.start}px)`,
          height: props.wrap ? undefined : `${ROW_HEIGHT}px`,
        }"
      >
        <span
          class="sticky left-0 shrink-0 bg-surface-cut pr-3 text-right text-[var(--fg-subtle)] tabular-nums select-none"
          :style="{ width: `${gutterChars}ch` }"
          aria-hidden="true"
          >{{ row.index + 1 }}</span
        >
        <span
          class="min-w-0 flex-1 pr-4"
          :class="[
            props.wrap ? 'break-all whitespace-pre-wrap' : 'whitespace-pre',
            lineClass(row.index),
          ]"
          ><span
            v-for="(segment, part) in segmentsFor(row.index)"
            :key="part"
            :class="
              segment.mark === 'current'
                ? 'rounded-xs bg-signal-mark text-background'
                : segment.mark === 'hit'
                  ? 'rounded-xs bg-signal-mark/25'
                  : undefined
            "
            :style="{
              color: segment.mark === 'current' ? undefined : segment.color,
              fontStyle: segment.italic ? 'italic' : undefined,
            }"
            >{{ segment.text }}</span
          ></span
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.code-tokens {
  --code-foreground: var(--fg-default);
  --code-background: transparent;
  --code-token-comment: var(--fg-subtle);
  --code-token-keyword: var(--cat-storage);
  --code-token-string: var(--state-success);
  --code-token-string-expression: var(--state-success);
  --code-token-constant: var(--cat-console);
  --code-token-function: var(--cat-network);
  --code-token-parameter: var(--fg-default);
  --code-token-punctuation: var(--fg-muted);
  --code-token-link: var(--signal-select);
  --code-token-inserted: var(--state-success);
  --code-token-deleted: var(--state-danger);
  --code-token-changed: var(--state-warning);
}
</style>
