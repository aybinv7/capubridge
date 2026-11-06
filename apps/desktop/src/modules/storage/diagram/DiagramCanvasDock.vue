<script setup lang="ts">
import { Hand, LayoutGrid, MousePointer2, StickyNote, Waypoints } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { StorageGraphCanvasMode } from "./storageGraphCanvas.utils";

/** The canvas tools: move around or select, add a note, lay out again, show guessed links. */
const mode = defineModel<StorageGraphCanvasMode>("mode", { required: true });

defineProps<{ showGuessed: boolean; laying: boolean }>();

const emit = defineEmits<{ addNote: []; autoLayout: []; toggleGuessed: [] }>();
</script>

<template>
  <div
    class="pointer-events-auto absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-well bg-surface-0 p-1 shadow-float ring-1 ring-border-subtle"
    role="toolbar"
    aria-label="Canvas tools"
  >
    <IconAction
      label="Move around"
      hint="Drag the canvas; drag nodes in Select"
      toggle
      :pressed="mode === 'pan'"
      @click="mode = 'pan'"
    >
      <Hand :stroke-width="1.8" />
    </IconAction>
    <IconAction
      label="Select"
      hint="Drag to select, Shift to add; drag between handles to link"
      toggle
      :pressed="mode === 'select'"
      @click="mode = 'select'"
    >
      <MousePointer2 :stroke-width="1.8" />
    </IconAction>
    <span class="mx-1 h-5 w-px bg-border-subtle" aria-hidden="true" />
    <IconAction label="Add a note" @click="emit('addNote')">
      <StickyNote :stroke-width="1.8" />
    </IconAction>
    <IconAction
      label="Lay out again"
      hint="Replaces the saved positions; Undo brings them back"
      :loading="laying"
      @click="emit('autoLayout')"
    >
      <LayoutGrid :stroke-width="1.8" />
    </IconAction>
    <IconAction
      :label="showGuessed ? 'Hide guessed links' : 'Show guessed links'"
      hint="Links guessed from fields that share a name"
      toggle
      :pressed="showGuessed"
      @click="emit('toggleGuessed')"
    >
      <Waypoints :stroke-width="1.8" />
    </IconAction>
  </div>
</template>
