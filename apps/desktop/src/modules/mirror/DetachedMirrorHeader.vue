<script setup lang="ts">
import {
  Camera,
  Video,
  Settings2,
  Pin,
  PinOff,
  Minus,
  Maximize2,
  Minimize2,
  X,
  Zap,
} from "lucide-vue-next";

defineProps<{
  deviceLabel: string;
  isRecording: boolean;
  laserMode: boolean;
  alwaysOnTop: boolean;
  isStreaming: boolean;
  settingsOpen: boolean;
  androidMode: boolean;
  isWindowMaximized: boolean;
}>();

const emit = defineEmits<{
  screenshot: [];
  toggleRecord: [];
  toggleLaser: [];
  toggleAlwaysOnTop: [];
  "update:settingsOpen": [value: boolean];
  minimizeWindow: [];
  toggleWindowMaximize: [];
  closeWindow: [];
}>();
</script>

<template>
  <div
    class="relative flex h-10 shrink-0 items-center border-b border-border/30 bg-background/90 px-2 backdrop-blur-md"
    style="-webkit-app-region: drag"
  >
    <div class="z-10 flex items-center gap-1" style="-webkit-app-region: no-drag">
      <button
        class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
        :class="
          isStreaming
            ? 'text-muted-foreground/55 hover:bg-accent hover:text-foreground'
            : 'cursor-not-allowed text-muted-foreground/20'
        "
        :disabled="!isStreaming"
        title="Screenshot"
        @click="isStreaming && emit('screenshot')"
      >
        <Camera class="h-3.5 w-3.5" />
      </button>

      <button
        v-if="androidMode"
        class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
        :class="
          isRecording
            ? 'bg-red-400/12 text-red-400 hover:bg-red-400/18'
            : isStreaming
              ? 'text-muted-foreground/55 hover:bg-accent hover:text-foreground'
              : 'cursor-not-allowed text-muted-foreground/20'
        "
        :disabled="!isStreaming && !isRecording"
        :title="isRecording ? 'Stop recording' : 'Start recording'"
        @click="(isStreaming || isRecording) && emit('toggleRecord')"
      >
        <div v-if="isRecording" class="h-3 w-3 rounded-sm bg-red-400" />
        <Video v-else class="h-3.5 w-3.5" />
      </button>

      <button
        class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
        :class="
          laserMode
            ? 'bg-red-400/12 text-red-400 hover:bg-red-400/18'
            : 'text-muted-foreground/55 hover:bg-accent hover:text-foreground'
        "
        title="Laser pen"
        @click="emit('toggleLaser')"
      >
        <Zap class="h-3.5 w-3.5" />
      </button>

      <button
        class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
        :class="
          settingsOpen
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground/55 hover:bg-accent hover:text-foreground'
        "
        title="Settings"
        @click="emit('update:settingsOpen', !settingsOpen)"
      >
        <Settings2 class="h-3.5 w-3.5" />
      </button>

      <button
        class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
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

    <div class="pointer-events-none absolute inset-0 flex items-center justify-center px-24">
      <div class="max-w-[44%] truncate text-[13px] font-semibold text-foreground/72">
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
