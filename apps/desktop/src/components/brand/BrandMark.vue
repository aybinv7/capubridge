<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number;
    live?: boolean;
  }>(),
  { size: 18, live: true },
);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="4 4 25 24"
    fill="none"
    role="img"
    aria-label="Capubridge"
  >
    <rect x="5" y="5" width="9" height="22" rx="2.5" stroke="currentColor" stroke-width="2" />
    <rect x="18" y="9" width="10" height="8" rx="2" stroke="currentColor" stroke-width="2" />
    <path
      d="M14 21h2.5v-8H18"
      :stroke="live ? 'var(--signal-live)' : 'currentColor'"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
