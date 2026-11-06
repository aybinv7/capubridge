<script setup lang="ts">
import { computed } from "vue";
import { hasStackFrames, javaStackLines } from "@/lib/stream-rows/foldStack";
import { findJson } from "@/lib/stream-rows/jsonInText";
import JsonBlock from "../list/JsonBlock.vue";
import RowActions from "../list/RowActions.vue";
import type { RowAction } from "../list/streamView.types";
import StackLines from "../list/StackLines.vue";
import type { LogsRow } from "./useLogsRows";

/**
 * An opened Logs row: who wrote it (fields that filter on click), the whole message with its
 * spacing kept, the stack folded after the app's own frames, and JSON in the message laid out.
 */
const props = defineProps<{
  row: LogsRow;
  appPackage: string | null;
  actions: readonly RowAction[];
}>();

const emit = defineEmits<{
  field: [key: "tag" | "pid" | "package", value: string, negate: boolean];
  action: [id: string];
}>();

const entry = computed(() => props.row.last);
const stack = computed(() => javaStackLines(entry.value.message, props.appPackage));
const folded = computed(() => hasStackFrames(stack.value));
const json = computed(() => (folded.value ? null : findJson(entry.value.message)));

const fields = computed(() => {
  const current = entry.value;
  const list: Array<{ key: "tag" | "pid" | "package"; label: string; value: string }> = [
    { key: "tag", label: "Tag", value: current.tag },
  ];
  const name = current.packageName ?? current.processName;
  if (name) list.push({ key: "package", label: "App", value: name });
  if (current.pid !== null) list.push({ key: "pid", label: "Process", value: String(current.pid) });
  return list;
});
</script>

<template>
  <div
    class="flex flex-col gap-2 border-y border-border-subtle bg-surface-cut px-3 py-2 shadow-cut"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-[var(--fg-subtle)]">
      <span class="font-mono tabular-nums">{{ entry.date }} {{ entry.time }}</span>
      <button
        v-for="field in fields"
        :key="field.key"
        type="button"
        class="flex items-center gap-1 hover:text-foreground"
        :title="`Click to filter to this ${field.label.toLowerCase()}, Alt+click to hide it`"
        @click="emit('field', field.key, field.value, $event.altKey)"
      >
        <span>{{ field.label }}</span>
        <span
          class="font-mono text-muted-foreground underline decoration-dotted underline-offset-2"
        >
          {{ field.value }}
        </span>
      </button>
      <span v-if="entry.tid !== null" class="font-mono">tid {{ entry.tid }}</span>
      <span v-if="entry.uid !== null" class="font-mono">uid {{ entry.uid }}</span>
      <span v-if="props.row.count > 1" class="tabular-nums">
        {{ props.row.count }} times, {{ props.row.first.time }} to {{ entry.time }}
      </span>
    </div>
    <StackLines v-if="folded" :lines="stack" />
    <template v-else-if="json">
      <p
        v-if="json.before.trim()"
        class="font-mono text-xs whitespace-pre-wrap break-all text-foreground"
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
    <pre v-else class="font-mono text-xs leading-5 whitespace-pre-wrap break-all text-foreground">{{
      entry.message
    }}</pre>
    <RowActions :actions="props.actions" @action="emit('action', $event)" />
  </div>
</template>
