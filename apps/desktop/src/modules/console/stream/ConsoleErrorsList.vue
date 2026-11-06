<script setup lang="ts">
import { shallowRef } from "vue";
import { CircleAlert } from "lucide-vue-next";
import type { ErrorGroup } from "@/lib/console/consoleErrors";
import type { ConsoleStreamRow } from "@/lib/console/consoleStream";
import { formatClockMs } from "@/shared/components/timeline/stripFormat";
import type { RowAction } from "../list/streamView.types";
import StreamList from "../list/StreamList.vue";
import ConsoleRowDetail from "./ConsoleRowDetail.vue";

/**
 * The Errors mode: `console.error` calls and uncaught exceptions grouped by their first line
 * and top app frame, newest first, each with how often and when. Opening a group shows its
 * newest occurrence.
 */
const props = defineProps<{
  groups: readonly ErrorGroup[];
  appOrigin: string | null;
  actionsFor: (row: ConsoleStreamRow) => RowAction[];
}>();

const emit = defineEmits<{
  action: [id: string, row: ConsoleStreamRow];
  copy: [groups: ErrorGroup[]];
}>();

const expanded = shallowRef<ReadonlySet<string>>(new Set());
const count = new Intl.NumberFormat();

function keyOf(group: ErrorGroup): string {
  return group.key;
}

function toggle(key: string) {
  const next = new Set(expanded.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expanded.value = next;
}

function asRow(group: ErrorGroup): ConsoleStreamRow {
  return {
    key: group.key,
    item: group.latest,
    depth: 0,
    count: group.count,
    firstTime: group.firstTime,
    firstSeq: group.latest.seq,
  };
}

function frameLabel(group: ErrorGroup): string | null {
  const frame = group.frame;
  if (!frame) return null;
  return `${frame.functionName || "(anonymous)"} · ${frame.source}`;
}
</script>

<template>
  <StreamList
    :rows="props.groups"
    :key-of="keyOf"
    :following="false"
    :tail="false"
    :expanded="expanded"
    label="Errors, grouped"
    @toggle="toggle"
    @copy="emit('copy', $event)"
  >
    <template #row="{ row, selected, active }">
      <div
        class="flex h-5.5 items-center gap-2 px-2 text-xs leading-none"
        :class="[
          selected ? 'bg-signal-select/12' : 'hover:bg-cladd-surface-hover',
          active ? 'shadow-[inset_2px_0_0_var(--signal-select)]' : '',
        ]"
      >
        <span
          class="w-[6ch] shrink-0 text-right font-mono text-2xs text-muted-foreground tabular-nums"
          :aria-label="`${row.count} times`"
        >
          ×{{ count.format(row.count) }}
        </span>
        <CircleAlert class="size-3 shrink-0 text-error" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate font-mono text-foreground">{{ row.message }}</span>
        <span
          v-if="frameLabel(row)"
          class="max-w-[35%] shrink-0 truncate font-mono text-2xs text-[var(--fg-subtle)]"
        >
          {{ frameLabel(row) }}
        </span>
        <span
          class="w-[11.5ch] shrink-0 text-right font-mono text-2xs text-[var(--fg-subtle)] tabular-nums"
        >
          {{ formatClockMs(row.lastTime) }}
        </span>
      </div>
    </template>
    <template #detail="{ row }">
      <ConsoleRowDetail
        :row="asRow(row)"
        :app-origin="props.appOrigin"
        :actions="props.actionsFor(asRow(row))"
        @action="emit('action', $event, asRow(row))"
      />
    </template>
  </StreamList>
</template>
