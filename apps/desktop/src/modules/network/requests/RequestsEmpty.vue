<script setup lang="ts">
import { Button } from "@capubridge/cladd";
import type { EmptyAction, EmptyCopy } from "./captureState";

const props = defineProps<{ copy: EmptyCopy; busy: boolean }>();

const emit = defineEmits<{ action: [action: Exclude<EmptyAction, null>] }>();

const ACTION_LABELS: Record<Exclude<EmptyAction, null>, string> = {
  "clear-filters": "Clear filters",
  resume: "Resume capture",
  reload: "Reload the page",
};

const GHOST_ROWS = [
  { left: 0, width: 38 },
  { left: 14, width: 22 },
  { left: 30, width: 46 },
  { left: 52, width: 18 },
];
</script>

<template>
  <div class="flex h-full items-center justify-center p-8">
    <div class="flex w-full max-w-sm flex-col items-center gap-4 text-center">
      <div class="flex w-56 flex-col gap-1.5" aria-hidden="true">
        <span v-for="(row, index) in GHOST_ROWS" :key="index" class="flex h-2 items-center">
          <span
            class="h-full rounded-inner bg-cat-network/20"
            :style="{ marginLeft: `${row.left}%`, width: `${row.width}%` }"
          />
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <p class="text-sm text-foreground">{{ props.copy.title }}</p>
        <p class="text-xs text-muted-foreground">{{ props.copy.text }}</p>
      </div>
      <Button
        v-if="props.copy.action"
        size="sm"
        variant="transparent"
        :loading="props.busy"
        @click="emit('action', props.copy.action)"
      >
        {{ ACTION_LABELS[props.copy.action] }}
      </Button>
    </div>
  </div>
</template>
