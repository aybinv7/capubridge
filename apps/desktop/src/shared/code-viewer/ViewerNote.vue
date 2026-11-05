<script setup lang="ts">
import { Info } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";

const props = defineProps<{ text: string; actionLabel?: string }>();

const emit = defineEmits<{ action: [] }>();
</script>

<template>
  <div
    class="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-info-bg px-3 py-1.5 text-xs text-foreground"
    role="note"
  >
    <Info :size="14" :stroke-width="1.8" class="shrink-0 text-info" aria-hidden="true" />
    <span class="min-w-0 flex-1">{{ props.text }}</span>
    <Button
      v-if="props.actionLabel"
      size="sm"
      variant="transparent"
      class="shrink-0"
      @click="emit('action')"
    >
      {{ props.actionLabel }}
    </Button>
  </div>
</template>
