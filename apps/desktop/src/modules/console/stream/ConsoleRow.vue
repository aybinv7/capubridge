<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight } from "lucide-vue-next";
import { inlineBlock } from "@/lib/console/consoleLines";
import type { ConsoleStreamRow } from "@/lib/console/consoleStream";
import { formatClockMs } from "@/shared/components/timeline/stripFormat";
import RepeatBadge from "../list/RepeatBadge.vue";
import { consoleLocation, consoleSourceLabel, consoleTone } from "./consoleTone";
import PreviewText from "./PreviewText.vue";

/**
 * One Console message the way DevTools prints it: time, level, the first line and, at the right
 * edge, the script and line it came from, on a 22 px line; then the message's further lines and
 * an Error's stack frames below it, up to the inline limit. Objects show as their preview (`{id: 1, name: 'x', …}`) rather than "Object".
 */
const props = defineProps<{
  row: ConsoleStreamRow;
  selected: boolean;
  active: boolean;
  expanded: boolean;
  groupOpen: boolean;
}>();

const emit = defineEmits<{
  source: [negate: boolean];
  group: [];
}>();

const item = computed(() => props.row.item);
const tone = computed(() => consoleTone(item.value));
const block = computed(() => inlineBlock(item.value));
const firstLine = computed(() => block.value.lines[0]?.segments ?? []);
const restLines = computed(() => block.value.lines.slice(1));
const source = computed(() => consoleSourceLabel(item.value));
const location = computed(() => consoleLocation(item.value));
const isGroup = computed(() => item.value.kind === "entry" && item.value.entry.isGroup);
const indent = computed(() => `${props.row.depth * 14}px`);
const continuationIndent = computed(
  () => `calc(0.5rem + 11.5ch + 0.75rem + 1rem + ${indent.value})`,
);
const time = computed(() => formatClockMs(item.value.time));
</script>

<template>
  <div
    class="overflow-hidden font-mono text-xs"
    :class="[
      props.selected ? 'bg-signal-select/12' : 'hover:bg-cladd-surface-hover',
      props.active ? 'shadow-[inset_2px_0_0_var(--signal-select)]' : '',
    ]"
  >
    <div class="flex h-5.5 items-center gap-2 px-2 leading-none">
      <span class="w-[11.5ch] shrink-0 text-[var(--fg-subtle)] tabular-nums">{{ time }}</span>
      <span
        class="w-3 shrink-0 text-center font-medium"
        :class="tone.glyphClass"
        :aria-label="tone.name"
      >
        {{ tone.glyph }}
      </span>
      <span class="flex min-w-0 flex-1 items-center gap-1" :style="{ paddingLeft: indent }">
        <button
          v-if="isGroup"
          type="button"
          tabindex="-1"
          class="flex size-4 shrink-0 items-center justify-center text-[var(--fg-subtle)] hover:text-foreground"
          :aria-label="props.groupOpen ? 'Close the group' : 'Open the group'"
          @click.stop="emit('group')"
        >
          <ChevronRight
            class="size-3 transition-transform duration-120"
            :class="props.groupOpen ? 'rotate-90' : ''"
          />
        </button>
        <span class="min-w-0 truncate" :class="[tone.textClass, isGroup ? 'font-medium' : '']">
          <PreviewText :segments="firstLine" :fallback-class="tone.textClass" />
        </span>
      </span>
      <RepeatBadge
        v-if="props.row.count > 1"
        :count="props.row.count"
        :first="formatClockMs(props.row.firstTime)"
        :last="time"
      />
      <button
        v-if="source"
        type="button"
        tabindex="-1"
        class="max-w-[32ch] shrink-0 truncate text-right text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
        :title="`${location ?? source}\nClick to keep only this script, Alt+click to hide it`"
        @click.stop="emit('source', $event.altKey)"
      >
        {{ source }}
      </button>
    </div>
    <div
      v-if="restLines.length > 0 || block.hidden > 0"
      class="pr-2 pb-1"
      :style="{ paddingLeft: continuationIndent }"
    >
      <div
        v-for="(line, index) in restLines"
        :key="index"
        class="truncate leading-4"
        :class="line.kind === 'frame' ? 'text-muted-foreground' : tone.textClass"
      >
        <PreviewText
          :segments="line.segments"
          :fallback-class="line.kind === 'frame' ? 'text-muted-foreground' : tone.textClass"
        />
      </div>
      <div v-if="block.hidden > 0" class="leading-4 text-[var(--fg-subtle)]">
        {{ block.hidden }} more {{ block.hidden === 1 ? "line" : "lines" }}, open the message to
        read them
      </div>
    </div>
  </div>
</template>
