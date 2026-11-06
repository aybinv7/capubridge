<script setup lang="ts">
import { computed } from "vue";
import { Power } from "lucide-vue-next";
import RepeatBadge from "../list/RepeatBadge.vue";
import { logcatLevelTone } from "./logsTone";
import type { LogsRow } from "./useLogsRows";

/** One 22 px line of Logs: time, level, tag, message, and the repeat count when it repeats. */
const props = defineProps<{
  row: LogsRow;
  selected: boolean;
  active: boolean;
  expanded: boolean;
  processColumn: boolean;
}>();

const emit = defineEmits<{
  field: [key: "tag" | "pid" | "package", value: string, negate: boolean];
}>();

const entry = computed(() => props.row.last);
const tone = computed(() => logcatLevelTone(entry.value.level));
const lines = computed(() => {
  const message = entry.value.message;
  const end = message.indexOf("\n");
  if (end < 0) return { first: message, more: 0 };
  let more = 0;
  for (let index = end; index >= 0; index = message.indexOf("\n", index + 1)) more += 1;
  return { first: message.slice(0, end), more };
});
const processLabel = computed(() => {
  const name = entry.value.packageName ?? entry.value.processName;
  return name ? (name.split(".").at(-1) ?? name) : "";
});
const hover = computed(() => {
  const current = entry.value;
  const parts = [
    current.packageName ?? current.processName ?? "system",
    current.pid === null ? null : `pid ${current.pid}`,
    current.tid === null ? null : `tid ${current.tid}`,
  ];
  return parts.filter(Boolean).join(" · ");
});

function filterBy(
  key: "tag" | "pid" | "package",
  value: string | number | null,
  event: MouseEvent,
) {
  if (value === null || value === "") return;
  emit("field", key, String(value), event.altKey);
}
</script>

<template>
  <div
    class="flex h-5.5 items-center gap-2 px-2 font-mono text-xs leading-none"
    :class="[
      props.selected ? 'bg-signal-select/12' : 'hover:bg-cladd-surface-hover',
      props.active ? 'shadow-[inset_2px_0_0_var(--signal-select)]' : '',
    ]"
  >
    <span class="w-[11.5ch] shrink-0 text-[var(--fg-subtle)] tabular-nums">{{ entry.time }}</span>
    <template v-if="entry.marker">
      <Power class="size-3 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
      <span class="shrink-0 font-sans text-[var(--fg-subtle)]">{{ entry.message }}</span>
      <span
        class="h-0 min-w-4 flex-1 border-t border-dashed border-border-default"
        aria-hidden="true"
      />
    </template>
    <template v-else>
      <span
        class="w-3 shrink-0 text-center font-medium"
        :class="tone.glyph"
        :aria-label="tone.name"
      >
        {{ entry.level }}
      </span>
      <button
        type="button"
        tabindex="-1"
        class="w-[18ch] shrink-0 truncate text-left text-muted-foreground hover:text-foreground hover:underline"
        :title="`${hover}\nClick to filter to this tag, Alt+click to hide it`"
        @click.stop="filterBy('tag', entry.tag, $event)"
      >
        {{ entry.tag }}
      </button>
      <button
        v-if="props.processColumn"
        type="button"
        tabindex="-1"
        class="w-[16ch] shrink-0 truncate text-left text-[var(--fg-subtle)] hover:text-foreground hover:underline"
        :title="`${hover}\nClick to keep only this process, Alt+click to hide it`"
        @click.stop="filterBy('pid', entry.pid, $event)"
      >
        {{ entry.pid ?? "–" }} {{ processLabel }}
      </button>
      <span class="min-w-0 flex-1 truncate" :class="tone.text">
        {{ lines.first }}
        <span v-if="lines.more > 0 && !props.expanded" class="text-[var(--fg-subtle)]">
          +{{ lines.more }} {{ lines.more === 1 ? "line" : "lines" }}
        </span>
      </span>
    </template>
    <RepeatBadge
      v-if="props.row.count > 1"
      :count="props.row.count"
      :first="props.row.first.time"
      :last="entry.time"
    />
  </div>
</template>
