<script setup lang="ts">
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import { useMirrorStore } from "@/stores/mirror.store";

const props = defineProps<{ androidMode: boolean }>();

const mirrorStore = useMirrorStore();

const fpsOptions = [5, 10, 15, 30] as const;
const qualityOptions = ["720p", "1080p", "1440p"] as const;
const bitrateOptions = [4, 8, 16, 20] as const;

const labelClass = "text-xs text-muted-foreground";
const hintClass = "text-2xs text-[var(--fg-subtle)]";
</script>

<template>
  <div class="flex flex-col gap-3.5 p-3">
    <div v-if="!props.androidMode" class="flex flex-col gap-1.5">
      <span :class="labelClass">Viewport</span>
      <Segmented size="xs" aria-label="Viewport" class="w-full">
        <SegmentedButton
          class="flex-1"
          :active="mirrorStore.settings.chromeViewportMode === 'phone'"
          @click="mirrorStore.settings.chromeViewportMode = 'phone'"
        >
          Phone
        </SegmentedButton>
        <SegmentedButton
          class="flex-1"
          :active="mirrorStore.settings.chromeViewportMode === 'desktop'"
          @click="mirrorStore.settings.chromeViewportMode = 'desktop'"
        >
          Desktop
        </SegmentedButton>
      </Segmented>
    </div>

    <div v-if="!props.androidMode" class="flex flex-col gap-1.5">
      <span :class="labelClass">Frame rate</span>
      <Segmented size="xs" aria-label="Frame rate" class="w-full">
        <SegmentedButton
          v-for="fps in fpsOptions"
          :key="fps"
          class="flex-1 font-mono tabular-nums"
          :active="mirrorStore.settings.fps === fps"
          @click="mirrorStore.settings.fps = fps"
        >
          {{ fps }}
        </SegmentedButton>
      </Segmented>
    </div>

    <div v-if="props.androidMode" class="flex flex-col gap-1.5">
      <span :class="labelClass">Quality</span>
      <Segmented size="xs" aria-label="Stream and recording quality" class="w-full">
        <SegmentedButton
          v-for="quality in qualityOptions"
          :key="quality"
          class="flex-1 font-mono tabular-nums"
          :active="mirrorStore.settings.recordQuality === quality"
          @click="mirrorStore.settings.recordQuality = quality"
        >
          {{ quality }}
        </SegmentedButton>
      </Segmented>
      <span :class="hintClass">Applies to new recordings, and to the picture after a restart.</span>
    </div>

    <div v-if="props.androidMode" class="flex flex-col gap-1.5">
      <span :class="labelClass">Bitrate <span class="text-[var(--fg-subtle)]">Mbps</span></span>
      <Segmented size="xs" aria-label="Bitrate in megabits per second" class="w-full">
        <SegmentedButton
          v-for="bitrate in bitrateOptions"
          :key="bitrate"
          class="flex-1 font-mono tabular-nums"
          :active="mirrorStore.settings.recordBitrate === bitrate"
          @click="mirrorStore.settings.recordBitrate = bitrate"
        >
          {{ bitrate }}
        </SegmentedButton>
      </Segmented>
    </div>
  </div>
</template>
