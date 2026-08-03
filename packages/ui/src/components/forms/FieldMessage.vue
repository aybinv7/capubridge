<script setup lang="ts">
import type { UiAccent } from "../../foundations/contracts.ts";

withDefaults(
  defineProps<{
    accent?: UiAccent;
    id: string;
    invalid?: boolean;
    visible?: boolean;
  }>(),
  {
    accent: "brand",
    invalid: false,
    visible: false,
  },
);
</script>

<template>
  <span
    :id="id"
    class="cui-field-message"
    :class="[`cui-accent-${invalid ? 'red' : accent}`, visible && 'cui-field-message--visible']"
    :data-invalid="invalid || undefined"
  >
    <slot />
  </span>
</template>
