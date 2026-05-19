<script setup lang="ts">
defineSlots<{
  default?: () => unknown;
  end?: () => unknown;
}>();
</script>

<template>
  <div class="flex w-full items-center gap-2 text-xs">
    <div class="flex flex-1 items-center gap-1.5">
      <slot />
    </div>
    <div class="flex items-center gap-1.5">
      <slot name="end" />
    </div>
  </div>
</template>
