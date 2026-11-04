<script setup lang="ts">
import { Camera, MousePointer2, SlidersHorizontal, Square, Video } from "lucide-vue-next";
import { Toolbar } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { AndroidKeyCode } from "./useMirrorStream";
import MirrorControls from "./MirrorControls.vue";
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
            class="absolute top-0 left-11 w-56 overflow-hidden rounded-surface bg-popover shadow-float ring-1 ring-border-subtle"
          >
            <MirrorSettingsPanel :android-mode="androidMode" />
          </div>
        </Transition>

        <Toolbar
          size="sm"
          aria-label="Screen actions"
          aria-orientation="vertical"
          content-class-name="flex-col gap-0.5 p-1"
        >
          <IconAction
            label="Take a screenshot"
            hint="Saved as PNG to Downloads"
            size="sm"
            position="top"
            :disabled="!isStreaming"
            @click="emit('screenshot')"
          >
            <Camera :stroke-width="1.8" />
          </IconAction>
          <IconAction
            v-if="androidMode"
            :label="isRecording ? 'Stop and save the recording' : 'Record the screen'"
            hint="Saved as MP4 to Downloads"
            size="sm"
            position="top"
            toggle
            :pressed="isRecording"
            :disabled="!isStreaming && !isRecording"
            @click="emit('toggleRecord')"
          >
            <Square v-if="isRecording" :stroke-width="0" class="fill-signal-rec" />
            <Video v-else :stroke-width="1.8" />
          </IconAction>
          <IconAction
            label="Laser pointer"
            size="sm"
            position="top"
            toggle
            :pressed="laserMode"
            @click="emit('toggleLaser')"
          >
            <MousePointer2 :stroke-width="1.8" />
          </IconAction>
          <IconAction
            label="Screen settings"
            size="sm"
            position="top"
            toggle
            :pressed="settingsOpen"
            @click="emit('update:settingsOpen', !settingsOpen)"
          >
            <SlidersHorizontal :stroke-width="1.8" />
          </IconAction>
        </Toolbar>
      </div>

      <MirrorControls v-if="androidMode" vertical @keyevent="emit('keyevent', $event)" />
    </div>
  </div>
</template>
