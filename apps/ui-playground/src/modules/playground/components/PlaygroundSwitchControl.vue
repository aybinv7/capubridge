<script setup lang="ts">
import { Button, Switch } from "@capubridge/ui";

defineProps<{
  label: string;
}>();

const model = defineModel<boolean>({ required: true });
</script>

<template>
  <Button
    :aria-pressed="model"
    class="example-switch-control"
    content-class-name="example-switch-control__content"
    :outline="false"
    rounded
    variant="transparent"
    @click="model = !model"
  >
    <Switch
      as="span"
      :focusable="false"
      :hoverable="false"
      :input="false"
      :model-value="model"
      size="sm"
    />
    <span>{{ label }}</span>
  </Button>
</template>
