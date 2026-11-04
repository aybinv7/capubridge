<script setup lang="ts">
import { Shortcut } from "@capubridge/cladd";

/** `keys` uses Cladd token grammar: whitespace-separated, e.g. `cmd shift d`, `up down`, `esc`. */
defineProps<{ keys: string }>();
</script>

<template>
  <Shortcut size="xs" variant="solid" class="shrink-0">{{ keys }}</Shortcut>
</template>
