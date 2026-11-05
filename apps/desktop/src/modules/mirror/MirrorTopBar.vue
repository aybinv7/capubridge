<script setup lang="ts">
import { Camera, Video, Square, SquareArrowOutUpRight } from "lucide-vue-next";
import { StatusDot } from "@capubridge/cladd";
import type { MirrorSide } from "@/stores/mirror.store";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { MirrorStatus } from "./mirrorStatus";
import MirrorScreenMenu from "./MirrorScreenMenu.vue";

const props = defineProps<{
  status: MirrorStatus;
  isRecording: boolean;
  recordingTimecode: string;
  canCapture: boolean;
  androidMode: boolean;
  isLocal: boolean;
  laserMode: boolean;
  side: MirrorSide;
}>();

const emit = defineEmits<{
  screenshot: [];
  toggleRecord: [];
  detach: [];
  toggleLaser: [];
  toggleSide: [];
  launchScrcpy: [];
  refresh: [];
}>();
</script>

<template>
  <header class="flex h-10 shrink-0 items-center gap-2 pr-1.5 pl-3.5">
    <div class="flex min-w-0 flex-1 items-center gap-2" :title="props.status.description">
      <span class="shrink-0 text-sm font-medium text-foreground">Screen</span>
      <template v-if="props.isRecording">
        <span
          class="size-1.5 shrink-0 rounded-full bg-signal-rec motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <span class="truncate text-xs text-signal-rec">Recording</span>
        <span class="shrink-0 font-mono text-2xs tabular-nums text-signal-rec">
          {{ props.recordingTimecode }}
        </span>
      </template>
      <template v-else-if="!props.isLocal">
        <StatusDot
          :color="props.status.dotColor"
          :variant="props.status.dotVariant"
          :pulse="props.status.pulse"
        />
        <span class="truncate text-xs text-muted-foreground">{{ props.status.label }}</span>
        <span
          v-if="props.status.meta"
          class="shrink-0 font-mono text-2xs tabular-nums text-[var(--fg-subtle)]"
        >
          {{ props.status.meta }}
        </span>
      </template>
      <span v-else class="truncate text-xs text-muted-foreground">Local webview</span>
    </div>

    <div class="flex shrink-0 items-center gap-0.5">
      <IconAction
        v-if="!props.isLocal"
        label="Screenshot"
        hint="Copied to the clipboard and saved to Downloads"
        :disabled="!props.canCapture"
        @click="emit('screenshot')"
      >
        <Camera :stroke-width="1.8" />
      </IconAction>

      <IconAction
        v-if="props.androidMode"
        :label="props.isRecording ? 'Stop and save the recording' : 'Record the screen as a video'"
        hint="Saved as MP4 to Downloads"
        toggle
        :pressed="props.isRecording"
        :disabled="!props.canCapture && !props.isRecording"
        @click="emit('toggleRecord')"
      >
        <Square v-if="props.isRecording" :stroke-width="0" class="fill-signal-rec" />
        <Video v-else :stroke-width="1.8" />
      </IconAction>

      <IconAction
        v-if="!props.isLocal"
        label="Open in its own window"
        hint="Keeps the screen beside any app"
        @click="emit('detach')"
      >
        <SquareArrowOutUpRight :stroke-width="1.8" />
      </IconAction>

      <MirrorScreenMenu
        :android-mode="props.androidMode"
        :is-local="props.isLocal"
        :side="props.side"
        :laser-mode="props.laserMode"
        @toggle-laser="emit('toggleLaser')"
        @toggle-side="emit('toggleSide')"
        @launch-scrcpy="emit('launchScrcpy')"
        @refresh="emit('refresh')"
      />
    </div>
  </header>
</template>
