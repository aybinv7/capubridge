<script setup lang="ts">
import { ref } from "vue";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import JsonEditor from "@/modules/storage/localstorage/JsonEditor.vue";
import { ChevronDown, Copy, Check, Info } from "lucide-vue-next";

const props = defineProps<{
  open: boolean;
  editKey: string;
  editJson: string;
  currentRowIndex: number;
  totalCount: number;
  dialogEntrySize: string;
  copiedRaw: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "update:editJson": [value: string];
  navigate: [direction: "prev" | "next"];
  copy: [];
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
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
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
            <DialogTitle class="text-base font-medium">
              {{ editKey }}
            </DialogTitle>
            <span class="text-xs text-muted-foreground/40">{{ dialogEntrySize }}</span>
            <span class="text-[10px] text-muted-foreground/40 tabular-nums">
              {{ currentRowIndex >= 0 ? currentRowIndex + 1 : "-" }} / {{ totalCount }}
            </span>

            <span
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-3 text-muted-foreground/50 font-mono"
            >
              row
            </span>
          </div>

          <div class="flex items-center">
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
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
