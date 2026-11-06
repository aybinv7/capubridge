<script setup lang="ts">
import { Button, Spinner } from "@capubridge/cladd";

const props = defineProps<{
  title: string;
  text?: string;
  detail?: string | null;
  loading?: boolean;
  tone?: "default" | "error";
  actionLabel?: string;
}>();

const emit = defineEmits<{ action: [] }>();
</script>

<template>
  <div class="flex h-full items-center justify-center p-6">
    <div class="flex max-w-xs flex-col items-center gap-2 text-center" role="status">
      <Spinner v-if="props.loading" size="xs" />
      <p class="text-xs" :class="props.tone === 'error' ? 'text-error' : 'text-foreground'">
        {{ props.title }}
      </p>
      <p v-if="props.text" class="text-xs text-muted-foreground">{{ props.text }}</p>
      <p v-if="props.detail" class="font-mono text-2xs break-all text-[var(--fg-subtle)]">
        {{ props.detail }}
      </p>
      <Button
        v-if="props.actionLabel"
        size="sm"
        variant="transparent"
        class="mt-1"
        @click="emit('action')"
      >
        {{ props.actionLabel }}
      </Button>
    </div>
  </div>
</template>
