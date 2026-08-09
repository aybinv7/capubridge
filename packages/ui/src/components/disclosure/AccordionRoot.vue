<script setup lang="ts">
import { computed, shallowRef, useId } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import type { AccordionRootProps } from "./accordion.contracts.ts";
import { provideAccordionContext } from "./accordionContext.ts";

const props = withDefaults(defineProps<AccordionRootProps>(), {
  disabled: undefined,
  defaultValue: undefined,
  multiple: undefined,
  value: undefined,
});

const emit = defineEmits<{
  "update:value": [value: string | string[] | undefined];
}>();

defineSlots<{
  default?: () => unknown;
}>();

const d = useComponentDefaults("AccordionRoot", props, {
  disabled: false,
  multiple: false,
});
const baseId = useId();
const internalValue = shallowRef(d.value.defaultValue);
const isControlled = computed(() => d.value.value !== undefined);
const value = computed(() => (isControlled.value ? d.value.value : internalValue.value));

function setValue(next: string | string[] | undefined): void {
  if (!isControlled.value) internalValue.value = next;
  emit("update:value", next);
}

function isItemOpen(itemValue: string): boolean {
  return Array.isArray(value.value) ? value.value.includes(itemValue) : value.value === itemValue;
}

function toggleItem(itemValue: string): void {
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

provideAccordionContext(
  computed(() => ({
    baseId,
    disabled: d.value.disabled,
    isItemOpen,
    toggleItem,
  })),
);
</script>

<template>
  <slot />
</template>
