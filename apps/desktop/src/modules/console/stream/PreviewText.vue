<script setup lang="ts">
import { PREVIEW_TONE_CLASS, type PreviewSegment } from "@/lib/console/consolePreview";

/** Coloured value preview pieces on one line; `fallbackClass` colours plain text. */
const props = defineProps<{ segments: readonly PreviewSegment[]; fallbackClass?: string }>();
</script>

<template>
  <span class="whitespace-pre"
    ><span
      v-for="(segment, index) in props.segments"
      :key="index"
      :class="segment.tone === 'text' ? props.fallbackClass : PREVIEW_TONE_CLASS[segment.tone]"
      >{{ segment.text }}</span
    ></span
  >
</template>
