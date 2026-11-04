<script setup lang="ts">
import { Shortcut } from "@capubridge/cladd";

/**
 * `keys` uses Cladd token grammar: whitespace-separated, e.g. `cmd shift d`, `up down`, `esc`.
 * `quiet` drops the key surfaces so the hint reads as plain subtle text inside a control.
 */
defineProps<{ keys: string; quiet?: boolean }>();
</script>

<template>
  <Shortcut
    size="sm"
    :variant="quiet ? 'transparent' : 'solid'"
    :outline="!quiet"
    :key-class-name="quiet ? 'font-medium text-cladd-fg-softer' : undefined"
    class="shrink-0"
  >
    {{ keys }}
  </Shortcut>
</template>
