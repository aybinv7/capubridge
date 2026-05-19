<script setup lang="ts">
defineSlots<{
  default?: () => unknown;
}>();
</script>

<template>
  <div class="h-full min-h-0 w-full overflow-auto bg-[var(--bg-surface)]">
    <slot />
  </div>
</template>
