<script setup lang="ts">
import { computed } from "vue";
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { useCommandsStore } from "@/stores/commands.store";
import PaletteContent from "./PaletteContent.vue";

const commands = useCommandsStore();

const open = computed({
  get: () => commands.paletteOpen,
  set: (value: boolean) => {
    if (!value) commands.closePalette();
  },
});
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="palette-backdrop fixed inset-0 z-50 bg-cladd-backdrop/90" />
      <DialogContent
        class="fixed top-[14vh] left-1/2 z-50 flex w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-surface bg-popover shadow-float ring-1 ring-border-subtle palette-surface focus:outline-none"
        :aria-describedby="undefined"
        @open-auto-focus.prevent
      >
        <DialogTitle class="sr-only">Command palette</DialogTitle>
        <DialogDescription class="sr-only">
          Type to search. Start with open for apps, &gt; for actions, @ for devices and targets, #
          for tables and stores, or : for this screen.
        </DialogDescription>
        <PaletteContent />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.palette-surface[data-state="open"] {
  animation: palette-rise 500ms cubic-bezier(0, 1, 0.2, 1);
}

.palette-surface[data-state="closed"] {
  animation: palette-drop 200ms ease-in forwards;
}

.palette-backdrop[data-state="open"] {
  animation: palette-fade 500ms ease-out;
}

.palette-backdrop[data-state="closed"] {
  animation: palette-fade 200ms ease-in reverse forwards;
}

@keyframes palette-rise {
  from {
    transform: translateY(100vh) scaleX(0.65);
  }
}

@keyframes palette-drop {
  to {
    transform: translateY(100vh) scaleX(0.65);
  }
}

@keyframes palette-fade {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .palette-surface[data-state],
  .palette-backdrop[data-state] {
    animation-duration: 1ms;
  }
}
</style>
