<script setup lang="ts">
import { computed, provide, shallowRef, watch } from "vue";

import { radioGroupKey } from "./radioGroupContext.ts";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    loop?: boolean;
    name?: string;
    orientation?: "horizontal" | "vertical";
    required?: boolean;
  }>(),
  {
    disabled: false,
    loop: true,
    name: undefined,
    orientation: "vertical",
    required: false,
  },
);

const model = defineModel<string>({ default: "" });
const value = shallowRef(model.value);

watch(model, (next) => (value.value = next));
watch(value, (next) => (model.value = next));

provide(radioGroupKey, {
  disabled: computed(() => props.disabled),
  name: computed(() => props.name),
  required: computed(() => props.required),
  value,
});
</script>

<template>
  <div
    class="cui-radio-group flex gap-2"
    :class="props.orientation === 'horizontal' ? 'flex-row' : 'flex-col'"
    :data-orientation="props.orientation"
    role="radiogroup"
  >
    <slot />
  </div>
</template>
