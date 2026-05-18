<script setup lang="ts">
import { ref } from "vue";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import JsonEditor from "@/modules/storage/localstorage/JsonEditor.vue";
import {
  ChevronDown,
  Copy,
  Check,
  Info,
  Save,
  Trash2,
  AlertCircle,
  Pencil,
  GitCompare,
} from "lucide-vue-next";

defineProps<{
  open: boolean;
  editKey: string;
  editJson: string;
  currentRowIndex: number;
  totalCount: number;
  dialogEntrySize: string;
  copiedRaw: boolean;
  badge: null | "unsaved" | "invalid";
  canEdit: boolean;
  jsonEditorValid: boolean;
  hasChange?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "update:editJson": [value: string];
  "validity-change": [valid: boolean];
  navigate: [direction: "prev" | "next"];
  copy: [];
  save: [];
  delete: [];
  viewDiff: [];
}>();

const jsonEditorRef = ref<InstanceType<typeof JsonEditor> | null>(null);

function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === "f") {
    e.preventDefault();
    setTimeout(() => {
      jsonEditorRef.value?.filterInputRef?.focus();
      jsonEditorRef.value?.filterInputRef?.select();
    }, 100);
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="max-w-[90vw] min-w-[70vw] w-[90vw] h-[85vh] p-0 gap-0 flex flex-col"
      @keydown="handleKeydown"
    >
      <DialogHeader class="px-6 py-1.5 border-b border-border/30 shrink-0">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <button
              class="text-muted-foreground/40 hover:text-foreground transition-colors"
              @click="emit('navigate', 'prev')"
            >
              <ChevronDown :size="16" class="rotate-180" />
            </button>
            <button
              class="text-muted-foreground/40 hover:text-foreground transition-colors"
              @click="emit('navigate', 'next')"
            >
              <ChevronDown :size="16" />
            </button>
            <DialogTitle class="text-base font-medium truncate">
              {{ editKey }}
            </DialogTitle>
            <span class="text-xs text-muted-foreground/40 shrink-0">{{ dialogEntrySize }}</span>
            <span class="text-[10px] text-muted-foreground/40 tabular-nums shrink-0">
              {{ currentRowIndex >= 0 ? currentRowIndex + 1 : "-" }} / {{ totalCount }}
            </span>

            <span
              v-if="badge === 'unsaved'"
              class="flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-mono text-amber-400"
            >
              <Pencil :size="9" />
              unsaved
            </span>
            <span
              v-else-if="badge === 'invalid'"
              class="flex items-center gap-1 rounded-full bg-error/15 px-1.5 py-0.5 text-[10px] font-mono text-error"
            >
              <AlertCircle :size="9" />
              invalid JSON
            </span>
            <span
              v-else
              class="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/50"
            >
              row
            </span>

            <span
              v-if="!canEdit"
              class="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono text-amber-400/80"
              title="Table has no primary key — read-only"
            >
              read-only
            </span>
          </div>

          <div class="flex items-center gap-1">
            <Button
              v-if="hasChange"
              variant="ghost"
              size="sm"
              class="h-7 gap-1.5 px-2 text-[11px] text-amber-300 hover:text-amber-200"
              title="View change diff"
              @click="emit('viewDiff')"
            >
              <GitCompare :size="12" />
              Diff
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground"
              :disabled="!canEdit || badge !== 'unsaved'"
              @click="emit('save')"
            >
              <Save :size="12" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground/60 hover:text-error"
              :disabled="!canEdit"
              @click="emit('delete')"
            >
              <Trash2 :size="12" />
              Delete
            </Button>
            <Button
              variant="ghost"
              class="text-muted-foreground/40 hover:text-foreground transition-colors p-1"
              @click="emit('copy')"
            >
              <Check v-if="copiedRaw" :size="13" class="text-green-500" />
              <Copy v-else :size="13" />
            </Button>
            <div class="relative group">
              <Button
                variant="ghost"
                class="text-muted-foreground/40 hover:text-foreground transition-colors p-1 mr-4"
              >
                <Info :size="13" />
              </Button>
              <div
                class="absolute right-0 top-8 z-50 w-48 rounded-lg border border-border/30 bg-surface-1 px-3 py-2 text-[11px] text-muted-foreground/60 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none group-hover:pointer-events-auto"
              >
                <div class="space-y-1">
                  <div class="flex justify-between">
                    <span>Save</span><kbd class="font-mono text-foreground/50">Ctrl+S</kbd>
                  </div>
                  <div class="flex justify-between">
                    <span>Search</span><kbd class="font-mono text-foreground/50">Ctrl+F</kbd>
                  </div>
                  <div class="flex justify-between">
                    <span>Prev/Next</span><kbd class="font-mono text-foreground/50">Ctrl+↑↓</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogHeader>

      <div class="flex-1 overflow-hidden p-4">
        <JsonEditor
          ref="jsonEditorRef"
          :value="editJson"
          @update:value="emit('update:editJson', $event)"
          @validity-change="emit('validity-change', $event)"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
