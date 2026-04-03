<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <div class="h-10 border-b border-border/30 bg-surface-1 flex items-center px-4 shrink-0 gap-3">
    <div class="flex items-center gap-2">
      <h1 class="text-[13px] font-semibold text-foreground tracking-tight">{{ title }}</h1>
      <template v-if="subtitle">
        <div class="w-px h-3 bg-border/40" />
        <span class="text-2xs text-muted-foreground font-mono">{{ subtitle }}</span>
      </template>
    </div>
    <div v-if="$slots.actions" class="ml-auto flex items-center gap-1">
      <slot name="actions" />
    </div>
  </div>
</template>
