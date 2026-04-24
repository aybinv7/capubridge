<script setup lang="ts">
import { Minus, Maximize2, Minimize2, X, Pin, PinOff } from "lucide-vue-next";

defineProps<{
  deviceLabel: string;
  alwaysOnTop: boolean;
  isWindowMaximized: boolean;
}>();

const emit = defineEmits<{
  toggleAlwaysOnTop: [];
  minimizeWindow: [];
  toggleWindowMaximize: [];
  closeWindow: [];
}>();
</script>

<template>
  <div
    class="relative flex h-9 shrink-0 items-center border-b border-border/30 bg-background/92 px-2 backdrop-blur-md"
    style="-webkit-app-region: drag"
  >
    <div class="z-10 flex items-center gap-1" style="-webkit-app-region: no-drag">
      <button
        class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-accent hover:text-foreground"
        :class="
          alwaysOnTop
            ? 'bg-blue-400/12 text-blue-400 hover:bg-blue-400/18'
            : 'text-muted-foreground/55 hover:bg-accent hover:text-foreground'
        "
        :title="alwaysOnTop ? 'Unpin window' : 'Pin window on top'"
        @click="emit('toggleAlwaysOnTop')"
      >
        <Pin v-if="alwaysOnTop" class="h-3.5 w-3.5" />
        <PinOff v-else class="h-3.5 w-3.5" />
      </button>
    </div>

    <div class="pointer-events-none absolute inset-0 flex items-center justify-center px-22">
      <div class="max-w-[50%] truncate text-[13px] font-semibold text-foreground/90">
        {{ deviceLabel }}
      </div>
    </div>

    <div class="z-10 ml-auto flex items-center" style="-webkit-app-region: no-drag">
      <button
        class="flex h-8 w-9 items-center justify-center text-muted-foreground/45 transition-colors hover:bg-accent hover:text-foreground"
        title="Minimize"
        @click="emit('minimizeWindow')"
      >
        <Minus class="h-3 w-3" />
      </button>
      <button
        class="flex h-8 w-9 items-center justify-center text-muted-foreground/45 transition-colors hover:bg-accent hover:text-foreground"
        :title="isWindowMaximized ? 'Restore window' : 'Maximize window'"
        @click="emit('toggleWindowMaximize')"
      >
        <Minimize2 v-if="isWindowMaximized" class="h-3 w-3" />
        <Maximize2 v-else class="h-3 w-3" />
      </button>
      <button
        class="flex h-8 w-9 items-center justify-center text-muted-foreground/45 transition-colors hover:bg-destructive/80 hover:text-destructive-foreground"
        title="Close"
        @click="emit('closeWindow')"
      >
        <X class="h-3 w-3" />
      </button>
    </div>
  </div>
</template>
