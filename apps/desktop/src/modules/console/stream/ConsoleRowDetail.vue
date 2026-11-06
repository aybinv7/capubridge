<script setup lang="ts">
import { computed } from "vue";
import ConsoleArgsView from "@/components/console/ConsoleArgsView.vue";
import type { ConsoleStreamRow } from "@/lib/console/consoleStream";
import { findJson } from "@/lib/stream-rows/jsonInText";
import { formatClockMs } from "@/shared/components/timeline/stripFormat";
import JsonBlock from "../list/JsonBlock.vue";
import RowActions from "../list/RowActions.vue";
import type { RowAction } from "../list/streamView.types";
import StackLines from "../list/StackLines.vue";
import { jsStackLines } from "./consoleFrames";
import { consoleLocation, consoleTone } from "./consoleTone";

/**
 * An opened Console row: the arguments with their objects, the call stack folded after the
 * app's own frames, JSON laid out, and where it came from.
 */
const props = defineProps<{
  row: ConsoleStreamRow;
  appOrigin: string | null;
  actions: readonly RowAction[];
}>();

const emit = defineEmits<{ action: [id: string] }>();

const item = computed(() => props.row.item);
const tone = computed(() => consoleTone(item.value));
const location = computed(() => consoleLocation(item.value));
const frames = computed(() => {
  const current = item.value;
  if (current.kind === "entry") return current.entry.frames ?? [];
  if (current.kind === "exception") return current.exception.frames ?? [];
  return [];
});
const stack = computed(() => jsStackLines(frames.value, props.appOrigin));
const plainText = computed(() => {
  const current = item.value;
  if (current.kind === "exception") return current.exception.message;
  if (current.kind === "input") return current.repl.expression;
  if (current.kind === "result") return current.repl.result;
  return current.entry.args.every((arg) => arg.kind === "primitive") ? current.entry.message : null;
});
const json = computed(() =>
  plainText.value !== null && item.value.kind !== "input" ? findJson(plainText.value) : null,
);
const repeats = computed(() =>
  props.row.count > 1
    ? `${props.row.count} times, ${formatClockMs(props.row.firstTime)} to ${formatClockMs(item.value.time)}`
    : null,
);
</script>

<template>
  <div
    class="flex flex-col gap-2 border-y border-border-subtle bg-surface-cut px-3 py-2 shadow-cut"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-[var(--fg-subtle)]">
      <span>{{ tone.name }}</span>
      <span class="font-mono tabular-nums">{{ formatClockMs(item.time) }}</span>
      <span v-if="location" class="min-w-0 truncate font-mono" :title="location">{{
        location
      }}</span>
      <span v-if="repeats" class="tabular-nums">{{ repeats }}</span>
    </div>
    <div v-if="item.kind === 'entry' && plainText === null" class="font-mono text-xs leading-5">
      <ConsoleArgsView :args="item.entry.args" :text-class="tone.textClass" />
    </div>
    <template v-else-if="json">
      <p
        v-if="json.before.trim()"
        class="font-mono text-xs whitespace-pre-wrap break-all"
        :class="tone.textClass"
      >
        {{ json.before.trim() }}
      </p>
      <JsonBlock :json="json" />
      <p
        v-if="json.after.trim()"
        class="font-mono text-xs whitespace-pre-wrap break-all text-foreground"
      >
        {{ json.after.trim() }}
      </p>
    </template>
    <pre
      v-else
      class="font-mono text-xs leading-5 whitespace-pre-wrap break-all"
      :class="tone.textClass"
      >{{ plainText }}</pre
    >
    <StackLines v-if="stack.length > 0" :lines="stack" />
    <RowActions :actions="props.actions" @action="emit('action', $event)" />
  </div>
</template>
