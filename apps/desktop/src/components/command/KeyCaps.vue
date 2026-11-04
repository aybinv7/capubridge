<script setup lang="ts">
defineProps<{ keys: readonly string[] }>();
</script>

<template>
  <span class="flex shrink-0 items-center gap-0.5">
    <kbd
      v-for="(key, index) in keys"
      :key="`${key}-${index}`"
      class="flex h-[18px] min-w-[18px] items-center justify-center rounded-sm bg-[var(--bg-surface-cut)] px-1 font-mono text-2xs leading-none text-muted-foreground shadow-cut"
    >
      {{ key }}
    </kbd>
  </span>
</template>
