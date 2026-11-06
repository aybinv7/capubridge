<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight } from "lucide-vue-next";
import type { ConsoleStreamRow } from "@/lib/console/consoleStream";
import { formatClockMs } from "@/shared/components/timeline/stripFormat";
import RepeatBadge from "../list/RepeatBadge.vue";
import { consoleSource, consoleSummary, consoleTone } from "./consoleTone";

/** One 22 px line of the Console stream: time, level, source, message, repeats. */
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
const summary = computed(() => consoleSummary(item.value));
const source = computed(() => consoleSource(item.value));
const isGroup = computed(() => item.value.kind === "entry" && item.value.entry.isGroup);
const indent = computed(() => `${props.row.depth * 14}px`);
const time = computed(() => formatClockMs(item.value.time));
</script>

<template>
  <div
    class="flex h-5.5 items-center gap-2 px-2 font-mono text-xs leading-none"
    :class="[
      props.selected ? 'bg-signal-select/12' : 'hover:bg-cladd-surface-hover',
      props.active ? 'shadow-[inset_2px_0_0_var(--signal-select)]' : '',
    ]"
  >
    <span class="w-[11.5ch] shrink-0 text-[var(--fg-subtle)] tabular-nums">{{ time }}</span>
    <span
      class="w-3 shrink-0 text-center font-medium"
      :class="tone.glyphClass"
      :aria-label="tone.name"
    >
      {{ tone.glyph }}
    </span>
    <button
      v-if="source"
      type="button"
      tabindex="-1"
      class="w-[18ch] shrink-0 truncate text-left text-muted-foreground hover:text-foreground hover:underline"
      :title="`${source}\nClick to keep only this script, Alt+click to hide it`"
      @click.stop="emit('source', $event.altKey)"
    >
      {{ source }}
    </button>
    <span v-else class="w-[18ch] shrink-0" aria-hidden="true" />
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
        {{ summary }}
      </span>
    </span>
    <RepeatBadge
      v-if="props.row.count > 1"
      :count="props.row.count"
      :first="formatClockMs(props.row.firstTime)"
      :last="time"
    />
  </div>
</template>
