<script setup lang="ts">
import { computed, provide, shallowRef, watch } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import type { RadioGroupProps } from "./radio.contracts.ts";
import { radioGroupKey } from "./radioGroupContext.ts";

const props = withDefaults(defineProps<RadioGroupProps>(), {
  disabled: undefined,
  loop: undefined,
  name: undefined,
  orientation: undefined,
  required: undefined,
});

const d = useComponentDefaults("RadioGroup", props, {
  disabled: false,
  loop: true,
  orientation: "vertical" as RadioGroupProps["orientation"],
  required: false,
});

const model = defineModel<string>({ default: "" });
const value = shallowRef(model.value);

watch(model, (next) => (value.value = next));
watch(value, (next) => (model.value = next));

provide(radioGroupKey, {
  disabled: computed(() => d.value.disabled),
  name: computed(() => d.value.name),
  required: computed(() => d.value.required),
  value,
});
</script>

<template>
  <div
    class="cui-radio-group flex gap-2"
    :class="d.orientation === 'horizontal' ? 'flex-row' : 'flex-col'"
    :data-orientation="d.orientation"
    role="radiogroup"
  >
    <slot />
  </div>
</template>
