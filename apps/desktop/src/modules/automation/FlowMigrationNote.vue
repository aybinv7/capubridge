<script setup lang="ts">
import { Button } from "@capubridge/cladd";

const props = defineProps<{ note: string }>();
const emit = defineEmits<{ dismiss: [] }>();
</script>

<template>
  <div
    class="flex items-start gap-3 rounded-well bg-surface-cut px-4 py-3 shadow-cut"
    role="status"
  >
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p class="text-sm font-medium text-foreground">This flow was updated</p>
      <p class="text-xs text-muted-foreground">{{ props.note }}</p>
    </div>
    <Button
      variant="solid"
      surface-level="+2"
      size="sm"
      content-class-name="px-3"
      @click="emit('dismiss')"
    >
      Got it
    </Button>
  </div>
</template>
