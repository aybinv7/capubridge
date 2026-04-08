<script setup lang="ts">
import {
  Camera,
  Video,
  Square,
  Zap,
  Settings2,
  PanelRightOpen,
  PanelLeftOpen,
  ExternalLink,
  PanelLeft,
  Pin,
  PinOff,
  Maximize2,
} from "lucide-vue-next";
import type { MirrorSide } from "@/stores/mirror.store";

const props = defineProps<{
  isRecording: boolean;
  laserMode: boolean;
  alwaysOnTop: boolean;
  side: MirrorSide;
  isDetached: boolean;
  isStreaming: boolean;
  settingsOpen: boolean;
}>();

const emit = defineEmits<{
  screenshot: [];
  toggleRecord: [];
  toggleLaser: [];
  toggleAlwaysOnTop: [];
  toggleSide: [];
  toggleDetach: [];
  launchScrcpy: [];
  "update:settingsOpen": [val: boolean];
  maximize: [];
}>();
</script>

<template>
  <div
    class="h-8 flex items-center gap-0.5 px-1.5 border-b border-border/30 bg-background/80 shrink-0"
  >
    <!-- Side switch (attached only) -->
    <button
      v-if="!isDetached"
      class="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors"
      :title="side === 'right' ? 'Move to left side' : 'Move to right side'"
      @click="emit('toggleSide')"
    >
      <PanelRightOpen v-if="side === 'left'" class="w-3.5 h-3.5" />
      <PanelLeftOpen v-else class="w-3.5 h-3.5" />
    </button>

    <!-- Screenshot -->
    <button
      class="w-6 h-6 flex items-center justify-center rounded transition-colors"
      :class="
        isStreaming
          ? 'text-muted-foreground/50 hover:text-foreground hover:bg-accent'
          : 'text-muted-foreground/20 cursor-not-allowed'
      "
      title="Screenshot"
      :disabled="!isStreaming"
      @click="isStreaming && emit('screenshot')"
    >
      <Camera class="w-3.5 h-3.5" />
    </button>

    <!-- Record -->
    <button
      class="w-6 h-6 flex items-center justify-center rounded transition-colors"
      :class="
        isRecording
          ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
          : isStreaming
            ? 'text-muted-foreground/50 hover:text-foreground hover:bg-accent'
            : 'text-muted-foreground/20 cursor-not-allowed'
      "
      :title="isRecording ? 'Stop recording' : 'Start recording'"
      :disabled="!isStreaming && !isRecording"
      @click="(isStreaming || isRecording) && emit('toggleRecord')"
    >
      <div v-if="isRecording" class="w-3 h-3 rounded-sm bg-red-400" />
      <Video v-else class="w-3.5 h-3.5" />
    </button>

    <!-- Laser -->
    <button
      class="w-6 h-6 flex items-center justify-center rounded transition-colors"
      :class="
        laserMode
          ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
          : 'text-muted-foreground/50 hover:text-foreground hover:bg-accent'
      "
      title="Laser pointer"
      @click="emit('toggleLaser')"
    >
      <Zap class="w-3.5 h-3.5" />
    </button>

    <div class="flex-1" />

    <!-- Native scrcpy -->
    <button
      class="h-6 min-w-8 px-1 flex items-center justify-center rounded text-[10px] font-semibold tracking-wide text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
      title="Open native scrcpy window (high performance)"
      @click="emit('launchScrcpy')"
    >
      SC
    </button>

    <!-- Settings popover trigger -->
    <button
      class="w-6 h-6 flex items-center justify-center rounded transition-colors"
      :class="
        settingsOpen
          ? 'text-foreground bg-accent'
          : 'text-muted-foreground/50 hover:text-foreground hover:bg-accent'
      "
      title="Settings"
      @click="emit('update:settingsOpen', !settingsOpen)"
    >
      <Settings2 class="w-3.5 h-3.5" />
    </button>

    <!-- Always-on-top (detached window only) -->
    <button
      v-if="isDetached"
      class="w-6 h-6 flex items-center justify-center rounded transition-colors"
      :class="
        alwaysOnTop
          ? 'text-blue-400 bg-blue-400/10 hover:bg-blue-400/20'
          : 'text-muted-foreground/50 hover:text-foreground hover:bg-accent'
      "
      :title="alwaysOnTop ? 'Unpin from top' : 'Pin on top of all windows'"
      @click="emit('toggleAlwaysOnTop')"
    >
      <Pin v-if="alwaysOnTop" class="w-3.5 h-3.5" />
      <PinOff v-else class="w-3.5 h-3.5" />
    </button>

    <!-- Detach / maximize -->
    <button
      class="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
      :title="isDetached ? 'Maximize window' : 'Pop out to own window'"
      @click="isDetached ? emit('maximize') : emit('toggleDetach')"
    >
      <Maximize2 v-if="isDetached" class="w-3.5 h-3.5" />
      <ExternalLink v-else class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
