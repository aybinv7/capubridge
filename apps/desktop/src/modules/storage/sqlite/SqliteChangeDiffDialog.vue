<script setup lang="ts">
import { computed } from "vue";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GitCompare } from "lucide-vue-next";
import JsonDiffViewer from "@/shared/code-viewer/JsonDiff.vue";
import type { SqliteRecordChange } from "@/types/sqliteChanges.types";

const props = defineProps<{
  open: boolean;
  change: SqliteRecordChange | null;
}>();

defineEmits<{
  "update:open": [value: boolean];
}>();

const afterText = computed(() =>
  props.change?.afterValue == null ? "" : JSON.stringify(props.change.afterValue, null, 2),
);

const operationTone = computed(() => {
  switch (props.change?.operation) {
    case "add":
      return "border-success/30 bg-success/10 text-success";
    case "update":
      return "border-warning/30 bg-warning/10 text-warning";
    case "delete":
      return "border-error/30 bg-error/10 text-error";
    default:
      return "border-border/30 bg-surface-3 text-muted-foreground/60";
  }
});

const observedLabel = computed(() => {
  if (!props.change) return "";
  try {
    return new Date(props.change.observedAt).toLocaleString();
  } catch {
    return props.change.observedAt;
  }
});
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <!-- z-60 keeps the diff above any dialog already sitting at the shared
         z-50 layer; this one is opened from inside the row viewer. -->
    <DialogContent
      class="z-[60] max-w-[90vw] min-w-[70vw] w-[90vw] h-[80vh] p-0 gap-0 flex flex-col"
    >
      <DialogHeader class="px-6 py-2 border-b border-border/30 shrink-0">
        <div class="flex items-center gap-3">
          <GitCompare :size="16" class="text-warning" />
          <DialogTitle class="text-base font-medium truncate">
            {{ change?.tableName ?? "" }}
          </DialogTitle>
          <Badge
            v-if="change"
            variant="outline"
            class="h-5 border px-1.5 text-2xs font-mono uppercase tracking-wider"
            :class="operationTone"
          >
            {{ change.operation }}
          </Badge>
          <span
            class="text-2xs font-mono text-muted-foreground/40 truncate"
            :title="change?.rowKey"
          >
            {{ change?.rowKey }}
          </span>
          <span class="ml-auto text-2xs font-mono text-muted-foreground/40">
            {{ observedLabel }}
          </span>
        </div>
      </DialogHeader>

      <div class="flex-1 overflow-hidden p-4">
        <JsonDiffViewer
          v-if="change"
          :before-value="change.beforeValue"
          :after-text="afterText"
          readonly
        />
        <div
          v-else
          class="flex h-full items-center justify-center text-xs text-muted-foreground/40"
        >
          No change selected.
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
