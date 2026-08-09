<script setup lang="ts">
import { computed, shallowRef, useId } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import type { TabsProps } from "./tabs.contracts.ts";
import { provideTabsContext } from "./tabsContext.ts";

const props = withDefaults(defineProps<TabsProps>(), {
  defaultValue: undefined,
  value: undefined,
});

const emit = defineEmits<{
  "update:value": [value: string];
}>();

defineSlots<{
  default?: () => unknown;
}>();

const d = useComponentDefaults("Tabs", props, {});
const baseId = useId();
const internalValue = shallowRef(d.value.defaultValue);
const isControlled = computed(() => d.value.value !== undefined);
const value = computed(() => (isControlled.value ? d.value.value : internalValue.value));

function setValue(next: string): void {
  if (next === value.value) return;
  if (!isControlled.value) internalValue.value = next;
  emit("update:value", next);
}

provideTabsContext({ baseId, setValue, value });
</script>

<template>
  <slot />
</template>
