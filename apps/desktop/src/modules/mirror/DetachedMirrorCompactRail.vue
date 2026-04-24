<script setup lang="ts">
import {
  ChevronLeft,
  Home,
  LayoutGrid,
  Volume2,
  VolumeX,
  Power,
  Camera,
  Video,
  Zap,
  Settings2,
} from "lucide-vue-next";
import { AndroidKey, type AndroidKeyCode } from "./useMirrorStream";
import MirrorSettingsPanel from "./MirrorSettingsPanel.vue";

defineProps<{
  isRecording: boolean;
  laserMode: boolean;
  isStreaming: boolean;
  settingsOpen: boolean;
  androidMode: boolean;
}>();

const emit = defineEmits<{
  screenshot: [];
  toggleRecord: [];
  toggleLaser: [];
  "update:settingsOpen": [value: boolean];
  keyevent: [keycode: AndroidKeyCode];
}>();
</script>

<template>
  <div class="pointer-events-none absolute inset-y-2 left-2.5 z-20 flex items-start justify-start">
    <div class="pointer-events-auto relative flex h-full flex-col items-start justify-between">
      <div class="flex flex-col gap-2">
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="-translate-x-2 opacity-0"
          leave-to-class="-translate-x-2 opacity-0"
        >
          <div
            v-if="settingsOpen"
            class="absolute left-11 top-0 w-44 overflow-hidden rounded-xl border border-border/35 bg-background/96 shadow-2xl backdrop-blur-md"
          >
            <MirrorSettingsPanel :android-mode="androidMode" />
          </div>
        </Transition>

        <div
          class="flex w-10 flex-col gap-2 rounded-xl border border-border/30 bg-background/82 p-1.5 shadow-2xl backdrop-blur-md"
        >
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
            title="Laser"
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
        </div>
      </div>

      <div
        v-if="androidMode"
        class="flex w-10 flex-col gap-2 rounded-xl border border-border/30 bg-background/82 p-1.5 shadow-2xl backdrop-blur-md"
      >
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-accent hover:text-foreground"
          title="Volume down"
          @click="emit('keyevent', AndroidKey.VOLUME_DOWN)"
        >
          <VolumeX class="h-3.5 w-3.5" />
        </button>
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-accent hover:text-foreground"
          title="Volume up"
          @click="emit('keyevent', AndroidKey.VOLUME_UP)"
        >
          <Volume2 class="h-3.5 w-3.5" />
        </button>
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-accent hover:text-foreground"
          title="Back"
          @click="emit('keyevent', AndroidKey.BACK)"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
        </button>
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-accent hover:text-foreground"
          title="Home"
          @click="emit('keyevent', AndroidKey.HOME)"
        >
          <Home class="h-3.5 w-3.5" />
        </button>
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-accent hover:text-foreground"
          title="Recent apps"
          @click="emit('keyevent', AndroidKey.RECENTS)"
        >
          <LayoutGrid class="h-3.5 w-3.5" />
        </button>
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-accent hover:text-foreground"
          title="Screen sleep"
          @click="emit('keyevent', AndroidKey.SLEEP)"
        >
          <Power class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
