<script setup lang="ts">
import { computed } from "vue";
import { Dialog } from "@capubridge/cladd";
import JsonDiffViewer from "@/shared/code-viewer/JsonDiff.vue";
import { formatExactTime } from "@/shared/format/dates";
import type { SqliteRecordChange } from "@/types/sqliteChanges.types";

/** What the app changed in one row: the row before and after, side by side. */
const props = defineProps<{ change: SqliteRecordChange | null }>();

const open = defineModel<boolean>("open", { required: true });

const WORDS = { add: "Added", update: "Changed", delete: "Deleted" } as const;

const afterText = computed(() =>
  props.change?.afterValue == null ? "" : JSON.stringify(props.change.afterValue, null, 2),
);
const observed = computed(() => {
  const at = props.change ? Date.parse(props.change.observedAt) : Number.NaN;
  return Number.isNaN(at) ? "" : formatExactTime(at);
});
</script>

<template>
  <Dialog
    v-model:open="open"
    data-overlay
    :aria-label="change ? `What changed in a row of ${change.tableName}` : 'Row change'"
    class="h-[80vh] w-[min(1100px,calc(100vw-64px))] max-w-none"
    content-class-name="flex h-full flex-col gap-0 p-0"
  >
    <template v-if="change">
      <header class="flex shrink-0 items-baseline gap-3 border-b border-border-subtle px-4 py-3">
        <h2 class="text-sm font-medium text-foreground">
          {{ WORDS[change.operation] }} in {{ change.tableName }}
        </h2>
        <span class="min-w-0 truncate font-mono text-2xs text-[var(--fg-subtle)]">
          key {{ change.rowKey }}
        </span>
        <span class="ml-auto shrink-0 text-2xs text-muted-foreground">Seen {{ observed }}</span>
      </header>
      <div class="min-h-0 flex-1 overflow-hidden p-4">
        <JsonDiffViewer :before-value="change.beforeValue" :after-text="afterText" readonly />
      </div>
    </template>
  </Dialog>
</template>
