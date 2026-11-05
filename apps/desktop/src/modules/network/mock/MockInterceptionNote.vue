<script setup lang="ts">
import { Button, StatusDot } from "@capubridge/cladd";

const props = defineProps<{ ruleCount: number; hasTarget: boolean }>();

const emit = defineEmits<{ turnOn: [] }>();
</script>

<template>
  <div
    class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border-subtle bg-surface-cut px-3 py-1.5"
    role="note"
  >
    <span class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <StatusDot variant="hollow" />
      <span>
        Interception is off, so
        {{ props.ruleCount === 1 ? "this rule answers" : "these rules answer" }}
        nothing yet. Requests reach the real servers.
      </span>
    </span>
    <span class="flex-1" />
    <Button
      size="sm"
      variant="solid-fill"
      class="shrink-0"
      :disabled="!props.hasTarget"
      @click="emit('turnOn')"
    >
      Intercept in the WebView
    </Button>
  </div>
</template>
