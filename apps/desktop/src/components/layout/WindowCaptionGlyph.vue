<script setup lang="ts">
defineProps<{ name: "minimize" | "maximize" | "restore" | "close" }>();
</script>

<template>
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    stroke="currentColor"
    stroke-width="1"
    shape-rendering="geometricPrecision"
    aria-hidden="true"
  >
    <path v-if="name === 'minimize'" d="M0 5.5h10" />
    <rect v-else-if="name === 'maximize'" x="0.5" y="0.5" width="9" height="9" rx="1.5" />
    <template v-else-if="name === 'restore'">
      <rect x="0.5" y="2.5" width="7" height="7" rx="1.25" />
      <path
        d="M2.5 2.5V1.75A1.25 1.25 0 0 1 3.75 0.5h4.5A1.25 1.25 0 0 1 9.5 1.75v4.5A1.25 1.25 0 0 1 8.25 7.5H7.5"
      />
    </template>
    <path v-else d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
  </svg>
</template>
