<script setup lang="ts">
defineSlots<{
  default?: () => unknown;
  end?: () => unknown;
}>();
</script>

<template>
  <div class="flex w-full items-center gap-3 text-[11px] text-[var(--fg-muted)]">
    <div class="flex flex-1 items-center gap-3">
      <slot />
    </div>
    <div class="flex items-center gap-3">
      <slot name="end" />
    </div>
  </div>
</template>
