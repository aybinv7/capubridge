<script setup lang="ts">
defineProps<{
  kind?: "check" | "minus";
}>();
</script>

<template>
  <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
    <path
      v-if="kind === 'minus'"
      d="M4 8h8"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-width="2"
    />
    <path
      v-else
      d="m3.5 8 3 3 6-6"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
    />
  </svg>
</template>
