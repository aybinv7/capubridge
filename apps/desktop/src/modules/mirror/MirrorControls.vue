<script setup lang="ts">
import { ChevronLeft, Home, LayoutGrid, Volume2, VolumeX, Power } from "lucide-vue-next";
import { AndroidKey } from "./useMirrorStream";

const emit = defineEmits<{
  keyevent: [keycode: number];
}>();
</script>

<template>
  <div
    class="h-10 flex items-center justify-between px-2 border-t border-border/30 bg-background/80 shrink-0"
  >
    <!-- Volume -->
    <div class="flex gap-0.5">
      <button
        class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors"
        title="Volume down"
        @click="emit('keyevent', AndroidKey.VOLUME_DOWN)"
      >
        <VolumeX class="w-3.5 h-3.5" />
      </button>
      <button
        class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors"
        title="Volume up"
        @click="emit('keyevent', AndroidKey.VOLUME_UP)"
      >
        <Volume2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Navigation -->
    <div class="flex items-center gap-1">
      <button
        class="w-8 h-8 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
        title="Back"
        @click="emit('keyevent', AndroidKey.BACK)"
      >
        <ChevronLeft class="w-4 h-4" />
      </button>
      <button
        class="w-8 h-8 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
        title="Home"
        @click="emit('keyevent', AndroidKey.HOME)"
      >
        <Home class="w-4 h-4" />
      </button>
      <button
        class="w-8 h-8 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
        title="Recent apps"
        @click="emit('keyevent', AndroidKey.RECENTS)"
      >
        <LayoutGrid class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Power/sleep -->
    <button
      class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors"
      title="Screen sleep"
      @click="emit('keyevent', AndroidKey.SLEEP)"
    >
      <Power class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
