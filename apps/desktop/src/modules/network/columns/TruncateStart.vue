<script setup lang="ts">
/**
 * Text that gives way from its start, so the end (a file, the last folder, a query) stays in
 * view: "…/api/v1/orders/". The text itself keeps its left-to-right order.
 */
const props = defineProps<{ text: string }>();
</script>

<template>
  <span dir="rtl" class="block min-w-0 truncate text-left"
    ><bdi dir="ltr">{{ props.text }}</bdi></span
  >
</template>
