<script setup lang="ts">
import { RefreshCw } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import type { DeviceState } from "./deviceState";

const props = defineProps<{ state: DeviceState; refreshing: boolean }>();
const emit = defineEmits<{ rescan: [] }>();
</script>

<template>
  <div class="flex flex-col gap-3 rounded-well bg-surface-cut px-4 py-3.5 shadow-cut" role="status">
    <p class="text-sm font-medium text-foreground">{{ props.state.title }}</p>
    <ol class="flex flex-col gap-1.5">
      <li
        v-for="(step, index) in props.state.steps"
        :key="step"
        class="flex gap-2.5 text-xs text-muted-foreground"
      >
        <span class="w-3 shrink-0 text-right font-mono text-[var(--fg-subtle)]">{{
          index + 1
        }}</span>
        <span>{{ step }}</span>
      </li>
    </ol>
    <div>
      <Button
        variant="solid"
        surface-level="+2"
        size="sm"
        :loading="props.refreshing"
        content-class-name="gap-1.5 px-3 [&>svg]:size-3.5"
        @click="emit('rescan')"
      >
        <RefreshCw :stroke-width="1.8" />
        Check again
      </Button>
    </div>
  </div>
</template>
