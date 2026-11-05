<script setup lang="ts">
import {
  Camera,
  Video,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer2,
  Pin,
  PinOff,
  SlidersHorizontal,
  Square,
  X,
} from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";

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

const windowButton =
  "flex h-8 w-9 items-center justify-center text-[var(--fg-subtle)] transition-colors hover:bg-surface-2 hover:text-foreground";
</script>

<template>
  <div
    class="relative flex h-10 shrink-0 items-center bg-background px-2"
    style="-webkit-app-region: drag"
  >
    <div class="z-10 flex items-center gap-0.5" style="-webkit-app-region: no-drag">
      <IconAction
        label="Screenshot"
        hint="Copied to the clipboard and saved to Downloads"
        :disabled="!isStreaming"
        @click="emit('screenshot')"
      >
        <Camera :stroke-width="1.8" />
      </IconAction>
      <IconAction
        v-if="androidMode"
        :label="isRecording ? 'Stop and save the recording' : 'Record the screen as a video'"
        hint="Saved as MP4 to Downloads"
        toggle
        :pressed="isRecording"
        :disabled="!isStreaming && !isRecording"
        @click="emit('toggleRecord')"
      >
        <Square v-if="isRecording" :stroke-width="0" class="fill-signal-rec" />
        <Video v-else :stroke-width="1.8" />
      </IconAction>
      <IconAction label="Laser pointer" toggle :pressed="laserMode" @click="emit('toggleLaser')">
        <MousePointer2 :stroke-width="1.8" />
      </IconAction>
      <IconAction
        label="Screen settings"
        toggle
        :pressed="settingsOpen"
        @click="emit('update:settingsOpen', !settingsOpen)"
      >
        <SlidersHorizontal :stroke-width="1.8" />
      </IconAction>
      <IconAction
        :label="alwaysOnTop ? 'Stop keeping on top' : 'Keep on top of other windows'"
        toggle
        :pressed="alwaysOnTop"
        @click="emit('toggleAlwaysOnTop')"
      >
        <Pin v-if="alwaysOnTop" :stroke-width="1.8" />
        <PinOff v-else :stroke-width="1.8" />
      </IconAction>
    </div>

    <div class="pointer-events-none absolute inset-0 flex items-center justify-center px-24">
      <div class="max-w-[44%] truncate text-sm font-medium text-foreground">
        {{ deviceLabel }}
      </div>
    </div>

    <div class="z-10 ml-auto flex items-center" style="-webkit-app-region: no-drag">
      <button
        type="button"
        :class="windowButton"
        aria-label="Minimize"
        @click="emit('minimizeWindow')"
      >
        <Minus class="size-3" />
      </button>
      <button
        type="button"
        :class="windowButton"
        :aria-label="isWindowMaximized ? 'Restore window' : 'Maximize window'"
        @click="emit('toggleWindowMaximize')"
      >
        <Minimize2 v-if="isWindowMaximized" class="size-3" />
        <Maximize2 v-else class="size-3" />
      </button>
      <button
        type="button"
        class="flex h-8 w-9 items-center justify-center text-[var(--fg-subtle)] transition-colors hover:bg-error hover:text-background"
        aria-label="Close"
        @click="emit('closeWindow')"
      >
        <X class="size-3" />
      </button>
    </div>
  </div>
</template>
