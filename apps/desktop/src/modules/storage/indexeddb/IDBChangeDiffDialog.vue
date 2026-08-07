<script setup lang="ts">
import { computed } from "vue";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GitCompare } from "lucide-vue-next";
import JsonDiffViewer from "./JsonDiffViewer.vue";

const props = defineProps<{
  open: boolean;
  storeName: string;
  recordKey: string;
  observedAt?: string;
  beforeValue: unknown;
  afterText: string;
  operation: "add" | "update" | "delete";
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const operationTone = computed(() => {
  if (props.operation === "add") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (props.operation === "delete") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
});

const observedLabel = computed(() => {
  if (!props.observedAt) return "";
  try {
    return new Date(props.observedAt).toLocaleString();
  } catch {
    return props.observedAt;
  }
});
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-[90vw] min-w-[70vw] w-[90vw] h-[80vh] p-0 gap-0 flex flex-col">
      <DialogHeader class="px-6 py-2 border-b border-border/30 shrink-0">
        <div class="flex items-center gap-3">
          <GitCompare :size="16" class="text-amber-300" />
          <DialogTitle class="text-base font-medium truncate">{{ storeName }}</DialogTitle>
          <Badge
            variant="outline"
            class="h-5 border px-1.5 text-[10px] font-mono uppercase tracking-wider"
            :class="operationTone"
          >
            {{ operation }}
          </Badge>
          <span class="truncate font-mono text-[10px] text-muted-foreground/40" :title="recordKey">
            {{ recordKey }}
          </span>
          <span v-if="observedLabel" class="ml-auto font-mono text-[10px] text-muted-foreground/40">
            {{ observedLabel }}
          </span>
        </div>
      </DialogHeader>

      <div class="flex-1 overflow-hidden p-4">
        <JsonDiffViewer :before-value="beforeValue" :after-text="afterText" readonly />
      </div>
    </DialogContent>
  </Dialog>
</template>
