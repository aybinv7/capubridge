<script setup lang="ts">
import { computed } from "vue";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GitCompare } from "lucide-vue-next";
import JsonDiffViewer from "@/modules/storage/indexeddb/JsonDiffViewer.vue";
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
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "update":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "delete":
      return "border-red-500/30 bg-red-500/10 text-red-300";
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
    <DialogContent class="max-w-[90vw] min-w-[70vw] w-[90vw] h-[80vh] p-0 gap-0 flex flex-col">
      <DialogHeader class="px-6 py-2 border-b border-border/30 shrink-0">
        <div class="flex items-center gap-3">
          <GitCompare :size="16" class="text-amber-300" />
          <DialogTitle class="text-base font-medium truncate">
            {{ change?.tableName ?? "" }}
          </DialogTitle>
          <Badge
            v-if="change"
            variant="outline"
            class="h-5 border px-1.5 text-[10px] font-mono uppercase tracking-wider"
            :class="operationTone"
          >
            {{ change.operation }}
          </Badge>
          <span
            class="text-[10px] font-mono text-muted-foreground/40 truncate"
            :title="change?.rowKey"
          >
            {{ change?.rowKey }}
          </span>
          <span class="ml-auto text-[10px] font-mono text-muted-foreground/40">
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
          class="flex h-full items-center justify-center text-[12px] text-muted-foreground/40"
        >
          No change selected.
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
