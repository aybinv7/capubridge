<script setup lang="ts">
import { computed, shallowRef } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import Segmented from "./Segmented.vue";
import type { ToggleGroupProps } from "./toggleGroup.contracts.ts";
import { provideToggleGroupContext } from "./toggleGroupContext.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToggleGroupProps>(), {
  accent: undefined,
  activeColor: undefined,
  activeOutline: undefined,
  activeVariant: undefined,
  as: undefined,
  color: undefined,
  defaultValue: undefined,
  disabled: undefined,
  multiple: undefined,
  outline: undefined,
  rounded: undefined,
  size: undefined,
  value: undefined,
  variant: undefined,
});

const emit = defineEmits<{
  "update:value": [value: string | string[] | undefined];
}>();

defineSlots<{
  default?: () => unknown;
}>();

const d = useComponentDefaults("ToggleGroup", props, {
  multiple: false,
});
const internalValue = shallowRef(d.value.defaultValue);
const isControlled = computed(() => d.value.value !== undefined);
const value = computed(() => (isControlled.value ? d.value.value : internalValue.value));

function setValue(next: string | string[] | undefined): void {
  if (!isControlled.value) internalValue.value = next;
  emit("update:value", next);
}

function toggleValue(itemValue: string): void {
  if (d.value.multiple) {
    const current = value.value;
    const list = Array.isArray(current) ? current : current != null ? [current] : [];
    setValue(
      list.includes(itemValue) ? list.filter((entry) => entry !== itemValue) : [...list, itemValue],
    );
    return;
  }

  const current = Array.isArray(value.value) ? value.value[0] : value.value;
  setValue(current === itemValue ? undefined : itemValue);
}

provideToggleGroupContext(
  computed(() => ({
    multiple: d.value.multiple,
    toggleValue,
    value: value.value,
  })),
);

const segmentedProps = computed(() => ({
  accent: d.value.accent,
  activeColor: d.value.activeColor,
  activeOutline: d.value.activeOutline,
  activeVariant: d.value.activeVariant,
  as: d.value.as,
  color: d.value.color,
  disabled: d.value.disabled,
  outline: d.value.outline,
  rounded: d.value.rounded,
  size: d.value.size,
  variant: d.value.variant,
}));
</script>

<template>
  <Segmented v-bind="{ ...segmentedProps, ...$attrs }">
    <slot />
  </Segmented>
</template>
