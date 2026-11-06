<script setup lang="ts">
import { Minus, Plus, Redo2, Undo2 } from "lucide-vue-next";
import { Button, Tooltip } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";

/** Zoom and history for the canvas. */
defineProps<{ zoomPercent: number; canUndo: boolean; canRedo: boolean }>();

const emit = defineEmits<{ zoomOut: []; zoomIn: []; fit: []; undo: []; redo: [] }>();
</script>

<template>
  <div
    class="pointer-events-auto absolute bottom-3 left-3 z-30 flex items-center gap-0.5 rounded-well bg-surface-0 p-1 shadow-float ring-1 ring-border-subtle"
    role="toolbar"
    aria-label="Zoom and history"
  >
    <IconAction label="Zoom out" @click="emit('zoomOut')">
      <Minus :stroke-width="1.8" />
    </IconAction>
    <Tooltip :offset="6" content-class-name="px-2 py-1 text-xs">
      <template #trigger>
        <Button
          size="sm"
          variant="transparent"
          class="min-w-12 font-mono text-xs tabular-nums"
          aria-label="Fit the diagram in view"
          @click="emit('fit')"
        >
          {{ zoomPercent }}%
        </Button>
      </template>
      Fit the diagram in view
    </Tooltip>
    <IconAction label="Zoom in" @click="emit('zoomIn')">
      <Plus :stroke-width="1.8" />
    </IconAction>
    <span class="mx-1 h-5 w-px bg-border-subtle" aria-hidden="true" />
    <IconAction label="Undo" :disabled="!canUndo" @click="emit('undo')">
      <Undo2 :stroke-width="1.8" />
    </IconAction>
    <IconAction label="Redo" :disabled="!canRedo" @click="emit('redo')">
      <Redo2 :stroke-width="1.8" />
    </IconAction>
  </div>
</template>
