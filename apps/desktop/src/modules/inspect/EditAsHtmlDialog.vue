<script setup lang="ts">
import { ref, watch } from "vue";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const props = defineProps<{
  open: boolean;
  initialHtml: string;
  saving?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [html: string];
}>();

const draft = ref(props.initialHtml);

watch(
  () => [props.open, props.initialHtml] as const,
  ([open, html]) => {
    if (open) draft.value = html;
  },
);

function close() {
  emit("update:open", false);
}
function save() {
  emit("save", draft.value);
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>Edit as HTML</DialogTitle>
      </DialogHeader>
      <textarea
        v-model="draft"
        spellcheck="false"
        class="w-full h-72 bg-surface-2 border border-border/40 rounded p-2 font-mono text-xs text-foreground/90 outline-none focus:border-blue-400/40"
      />
      <div class="flex justify-end gap-2">
        <Button variant="ghost" size="sm" @click="close">Cancel</Button>
        <Button size="sm" :disabled="saving" @click="save">
          {{ saving ? "Saving…" : "Apply" }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
