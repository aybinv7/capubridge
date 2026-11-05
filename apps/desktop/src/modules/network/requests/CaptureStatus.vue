<script setup lang="ts">
import { computed } from "vue";
import { StatusDot, Tooltip, type Color } from "@capubridge/cladd";
import type { CaptureTone, CaptureWord } from "./captureState";

const props = defineProps<{ word: CaptureWord }>();

const DOT_COLOR: Record<CaptureTone, Color | undefined> = {
  live: "lime",
  neutral: undefined,
  warning: "yellow",
  error: "red",
};

const color = computed(() => DOT_COLOR[props.word.tone]);
</script>

<template>
  <Tooltip
    v-if="!props.word.echoed"
    :disabled="!props.word.detail"
    position="bottom"
    :offset="6"
    content-class-name="max-w-72 px-2 py-1 text-xs"
  >
    <template #trigger>
      <span
        class="flex shrink-0 items-center gap-1.5 text-xs"
        :class="props.word.tone === 'error' ? 'text-error' : 'text-muted-foreground'"
        role="status"
      >
        <StatusDot :color="color" :variant="props.word.solid ? 'solid' : 'hollow'" />
        {{ props.word.label }}
      </span>
    </template>
    {{ props.word.detail }}
  </Tooltip>
</template>
