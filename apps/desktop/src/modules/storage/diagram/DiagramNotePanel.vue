<script setup lang="ts">
import { ref, watch } from "vue";
import { Button, Input, Textarea } from "@capubridge/cladd";
import type { StorageGraphNoteNodeData } from "@/types/storageGraph.types";
import { NOTE_ACCENTS } from "./diagramAccents";

/** A note on the canvas: its title, its text and its colour. */
const props = defineProps<{ id: string; data: StorageGraphNoteNodeData }>();

const emit = defineEmits<{
  save: [payload: { id: string; title: string; note: string; accent: string }];
  remove: [id: string];
}>();

const title = ref("");
const body = ref("");
const accent = ref("");

watch(
  () => props.data,
  (data) => {
    title.value = data.title;
    body.value = data.note;
    accent.value = data.accent;
  },
  { immediate: true },
);

function save() {
  emit("save", {
    id: props.id,
    title: title.value.trim() || "Note",
    note: body.value,
    accent: accent.value,
  });
}
</script>

<template>
  <form class="flex flex-col gap-3" @submit.prevent="save">
    <label class="flex flex-col gap-1">
      <span class="text-2xs text-muted-foreground">Title</span>
      <Input v-model="title" size="md" placeholder="Note" />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-2xs text-muted-foreground">Text</span>
      <Textarea
        v-model="body"
        class="min-h-32"
        placeholder="Context for whoever reads this diagram"
      />
    </label>
    <div class="flex flex-col gap-1">
      <span id="diagram-note-colour" class="text-2xs text-muted-foreground">Colour</span>
      <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="diagram-note-colour">
        <button
          v-for="option in NOTE_ACCENTS"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="accent === option.value"
          :aria-label="option.label"
          class="size-6 rounded-full border-2 border-surface-0 ring-1 ring-border-subtle focus-visible:outline-2 focus-visible:outline-signal-select"
          :class="accent === option.value ? 'ring-2 ring-signal-select' : ''"
          :style="{ backgroundColor: option.value }"
          @click="accent = option.value"
        />
      </div>
    </div>
    <div class="flex items-center gap-2">
      <Button type="submit" size="sm" variant="solid-fill" color="brand">Save note</Button>
      <Button size="sm" variant="transparent" color="red" @click="emit('remove', id)">
        Delete note
      </Button>
    </div>
  </form>
</template>
