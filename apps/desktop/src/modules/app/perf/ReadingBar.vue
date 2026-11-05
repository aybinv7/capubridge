<script setup lang="ts">
import { Pause, Play } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { formatClock } from "@/shared/format/numbers";

const props = defineProps<{ lastSampleAt: number | null; paused: boolean }>();

const emit = defineEmits<{ pause: []; resume: [] }>();
</script>

<template>
  <div class="flex h-10 shrink-0 items-center justify-end gap-2 border-b border-border-subtle px-4">
    <span
      v-if="props.lastSampleAt !== null"
      class="font-mono text-2xs text-[var(--fg-subtle)] tabular-nums"
      :aria-label="`Newest reading at ${formatClock(props.lastSampleAt)}`"
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
      {{ props.paused ? "Resume readings" : "Pause readings" }}
    </Button>
  </div>
</template>
