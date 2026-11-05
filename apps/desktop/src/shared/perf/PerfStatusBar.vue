<script setup lang="ts">
import { Pause, Play } from "lucide-vue-next";
import { Button, StatusDot } from "@capubridge/cladd";
import { formatClock } from "@/shared/format/numbers";
import type { StatusCopy, StatusMark } from "./statusMark";

const props = defineProps<{
  dot: StatusMark;
  copy: StatusCopy;
  lastSampleAt: number | null;
  paused: boolean;
  showDetail: boolean;
}>();

const emit = defineEmits<{ pause: []; resume: [] }>();
</script>

<template>
  <div
    class="flex h-10 shrink-0 items-center gap-2 border-b border-border-subtle px-4"
    role="status"
    aria-live="polite"
  >
    <StatusDot :color="props.dot.color" :variant="props.dot.variant" />
    <span class="shrink-0 text-xs font-medium text-foreground">{{ props.copy.label }}</span>
    <span v-if="props.showDetail" class="min-w-0 truncate text-xs text-muted-foreground">
      {{ props.copy.detail }}
    </span>
    <span class="flex-1" />
    <span
      v-if="props.lastSampleAt !== null"
      class="shrink-0 font-mono text-2xs text-[var(--fg-subtle)] tabular-nums"
      :title="`Newest reading at ${formatClock(props.lastSampleAt)}`"
    >
      {{ formatClock(props.lastSampleAt) }}
    </span>
    <Button
      size="sm"
      variant="transparent"
      :outline="false"
      content-class-name="gap-1.5 px-2 [&>svg]:size-3.5"
      class="text-muted-foreground hover:text-foreground"
      @click="props.paused ? emit('resume') : emit('pause')"
    >
      <Play v-if="props.paused" :stroke-width="1.8" />
      <Pause v-else :stroke-width="1.8" />
      {{ props.paused ? "Resume" : "Pause" }}
    </Button>
  </div>
</template>
