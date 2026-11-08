<script setup lang="ts">
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import { useMirrorStore } from "@/stores/mirror.store";
import SettingsCard from "./components/SettingsCard.vue";
import SettingsPage from "./components/SettingsPage.vue";
import SettingsRow from "./components/SettingsRow.vue";

const mirror = useMirrorStore();

const FPS = [5, 10, 15, 30] as const;
const QUALITY = ["720p", "1080p", "1440p"] as const;
const BITRATE = [4, 8, 16, 20] as const;
</script>

<template>
  <SettingsPage
    title="Screen"
    description="The phone picture and its recordings. The screen column's settings change the same values."
  >
    <SettingsCard title="Phone">
      <SettingsRow
        label="Quality"
        description="Applies to new recordings, and to the picture after a restart."
      >
        <Segmented size="xs" aria-label="Stream and recording quality">
          <SegmentedButton
            v-for="quality in QUALITY"
            :key="quality"
            class="font-mono tabular-nums"
            :active="mirror.settings.recordQuality === quality"
            @click="mirror.settings.recordQuality = quality"
          >
            {{ quality }}
          </SegmentedButton>
        </Segmented>
      </SettingsRow>
      <SettingsRow label="Bitrate" description="Megabits per second. Higher is sharper and larger.">
        <Segmented size="xs" aria-label="Bitrate in megabits per second">
          <SegmentedButton
            v-for="bitrate in BITRATE"
            :key="bitrate"
            class="font-mono tabular-nums"
            :active="mirror.settings.recordBitrate === bitrate"
            @click="mirror.settings.recordBitrate = bitrate"
          >
            {{ bitrate }}
          </SegmentedButton>
        </Segmented>
      </SettingsRow>
    </SettingsCard>

    <SettingsCard title="Web previews">
      <SettingsRow
        label="Frame rate"
        description="Frames per second of a page shown in the screen column."
      >
        <Segmented size="xs" aria-label="Frame rate">
          <SegmentedButton
            v-for="fps in FPS"
            :key="fps"
            class="font-mono tabular-nums"
            :active="mirror.settings.fps === fps"
            @click="mirror.settings.fps = fps"
          >
            {{ fps }}
          </SegmentedButton>
        </Segmented>
      </SettingsRow>
    </SettingsCard>
  </SettingsPage>
</template>
