<script setup lang="ts">
import { ref, watch } from "vue";
import { Dialog, Input, Textarea } from "@capubridge/cladd";
import type { StorageGraphNodeAnnotation } from "@/types/storageGraph.types";

/** A table's alias and attached note, kept in this diagram only. */
const open = defineModel<boolean>("open", { required: true });

const props = defineProps<{ title: string; annotation: StorageGraphNodeAnnotation | undefined }>();

const emit = defineEmits<{ save: [annotation: StorageGraphNodeAnnotation] }>();

const alias = ref("");
const note = ref("");

watch(open, (isOpen) => {
  if (!isOpen) return;
  alias.value = props.annotation?.label ?? "";
  note.value = props.annotation?.note ?? "";
});

function save() {
  emit("save", {
    label: alias.value.trim() || undefined,
    note: note.value.trim() || undefined,
    accent: props.annotation?.accent,
  });
}
</script>

<template>
  <Dialog
    v-model:open="open"
    data-overlay
    :title="`Describe “${title}”`"
    text="Shown on the diagram only; the database is not changed."
    confirm-button-text="Save"
    cancel-button-text="Cancel"
    confirm-button-color="brand"
    class="w-[440px] max-w-[calc(100vw-48px)]"
    @confirm="save"
  >
    <div class="flex flex-col gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-muted-foreground">Alias</span>
        <Input v-model="alias" size="md" placeholder="A shorter or clearer name" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-muted-foreground">Note</span>
        <Textarea
          v-model="note"
          class="min-h-28"
          placeholder="What it holds, caveats, migrations"
        />
      </label>
    </div>
  </Dialog>
</template>
