<script setup lang="ts">
import { toRef } from "vue";
import { Camera, Video, MousePointer2, SlidersHorizontal, Square } from "lucide-vue-next";
import { Toolbar, ToolbarSeparator } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { AndroidKeyCode } from "./useMirrorStream";
import MirrorControls from "./MirrorControls.vue";
import MirrorSettingsPanel from "./MirrorSettingsPanel.vue";
import MirrorRotationActions from "./MirrorRotationActions.vue";
import type { DeviceOrientation } from "./deviceRotation";
import { useDeviceRotation } from "./useDeviceRotation";

const props = defineProps<{
  isRecording: boolean;
  laserMode: boolean;
  isStreaming: boolean;
  settingsOpen: boolean;
  androidMode: boolean;
  serial: string | null;
  streamOrientation: DeviceOrientation | null;
}>();

const emit = defineEmits<{
  screenshot: [];
  toggleRecord: [];
  toggleLaser: [];
  "update:settingsOpen": [value: boolean];
  keyevent: [keycode: AndroidKeyCode];
}>();

const rotation = useDeviceRotation({
  serial: toRef(props, "serial"),
  streamOrientation: toRef(props, "streamOrientation"),
});
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
          size="md"
          aria-label="Screen actions"
          aria-orientation="vertical"
          content-class-name="flex-col gap-0.5 p-1"
        >
          <IconAction
            label="Screenshot"
            hint="Copied to the clipboard and saved to Downloads"
            size="md"
            position="top"
            :disabled="!isStreaming"
            @click="emit('screenshot')"
          >
            <Camera :stroke-width="1.8" />
          </IconAction>
          <IconAction
            v-if="androidMode"
            :label="isRecording ? 'Stop and save the recording' : 'Record the screen as a video'"
            hint="Saved as MP4 to Downloads"
            size="md"
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
            size="md"
            position="top"
            toggle
            :pressed="laserMode"
            @click="emit('toggleLaser')"
          >
            <MousePointer2 :stroke-width="1.8" />
          </IconAction>
          <IconAction
            label="Screen settings"
            size="md"
            position="top"
            toggle
            :pressed="settingsOpen"
            @click="emit('update:settingsOpen', !settingsOpen)"
          >
            <SlidersHorizontal :stroke-width="1.8" />
          </IconAction>
          <template v-if="androidMode">
            <ToolbarSeparator class="mx-0 my-1 h-px w-1/2 self-center" />
            <MirrorRotationActions
              :target="rotation.target.value"
              :locked="rotation.locked.value"
              :available="rotation.available.value && Boolean(props.serial)"
              :busy="rotation.busy.value"
              @rotate="rotation.rotate()"
              @restore-auto="rotation.restoreAuto()"
            />
          </template>
        </Toolbar>
      </div>

      <MirrorControls v-if="androidMode" vertical @keyevent="emit('keyevent', $event)" />
    </div>
  </div>
</template>
