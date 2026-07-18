<script setup lang="ts">
import { computed } from "vue";
import { GitCompare } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import JsonViewer from "@/shared/components/data/JsonViewer.vue";
import type { SqliteRecordChange } from "@/types/sqliteChanges.types";

const props = defineProps<{
  open: boolean;
  change: SqliteRecordChange | null;
}>();

defineEmits<{
  "update:open": [value: boolean];
}>();

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
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="flex h-[80vh] w-[90vw] max-w-[90vw] flex-col gap-0 p-0">
      <DialogHeader class="shrink-0 border-b border-border/30 px-6 py-3">
        <div class="flex items-center gap-3">
          <GitCompare :size="16" class="text-amber-300" />
          <DialogTitle class="truncate text-base font-medium">
            {{ change?.tableName ?? "Captured change" }}
          </DialogTitle>
          <Badge
            v-if="change"
            variant="outline"
            class="h-5 border px-1.5 font-mono text-[10px] uppercase tracking-wider"
            :class="operationTone"
          >
            {{ change.operation }}
          </Badge>
          <span class="truncate font-mono text-[10px] text-muted-foreground/40">
            {{ change?.rowKey }}
          </span>
        </div>
      </DialogHeader>

      <div v-if="change" class="grid min-h-0 flex-1 grid-cols-2 divide-x divide-border/30">
        <section class="flex min-h-0 flex-col overflow-hidden">
          <div class="shrink-0 border-b border-border/20 px-3 py-2 text-xs text-muted-foreground">
            Before
          </div>
          <div class="min-h-0 flex-1 overflow-hidden">
            <JsonViewer :value="change.beforeValue" />
          </div>
        </section>
        <section class="flex min-h-0 flex-col overflow-hidden">
          <div class="shrink-0 border-b border-border/20 px-3 py-2 text-xs text-muted-foreground">
            After
          </div>
          <div class="min-h-0 flex-1 overflow-hidden">
            <JsonViewer :value="change.afterValue" />
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
