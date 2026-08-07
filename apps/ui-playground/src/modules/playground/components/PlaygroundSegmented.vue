<script setup lang="ts">
import { Button } from "@capubridge/ui";

const props = withDefaults(
  defineProps<{
    items: readonly string[];
    label?: string;
  }>(),
  {
    label: undefined,
  },
);

const model = defineModel<string>({ required: true });
</script>

<template>
  <div :aria-label="props.label" class="example-segmented" role="group">
    <Button
      v-for="item in props.items"
      :key="item"
      :aria-pressed="model === item"
      :outline="model === item"
      :read-only="model === item"
      rounded
      size="md"
      :surface-level="model === item ? '+2' : undefined"
      :variant="model === item ? 'gradient' : 'transparent'"
      @click="model = item"
    >
      {{ item }}
    </Button>
  </div>
</template>
