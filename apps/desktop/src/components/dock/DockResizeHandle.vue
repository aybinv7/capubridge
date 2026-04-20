<script setup lang="ts">
const emit = defineEmits<{
  resizeStart: [event: MouseEvent];
  toggleHeight: [];
}>();
</script>

<template>
  <button
    type="button"
    class="group flex h-4 w-full shrink-0 cursor-row-resize items-center justify-center border-b border-border bg-background/95 outline-none transition-colors hover:bg-surface-1"
    title="Resize dock"
    @mousedown.prevent="emit('resizeStart', $event)"
    @dblclick="emit('toggleHeight')"
  >
    <span class="h-1 w-12 rounded-full bg-border transition-colors group-hover:bg-border-active" />
  </button>
</template>
