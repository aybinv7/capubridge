<script setup lang="ts">
import { computed, getCurrentInstance, shallowRef } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import Segmented from './Segmented.vue';
import type { ToggleGroupProps } from './toggleGroup.contracts.ts';
import { provideToggleGroupContext } from './toggleGroupContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToggleGroupProps>(), {
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
  'update:value': [value: string | string[] | undefined];
}>();

defineSlots<{
  default?: () => unknown;
}>();

const d = useComponentDefaults('ToggleGroup', props, {
  multiple: false,
});

// Controlled when the `value` prop is bound at all, not when it currently
// resolves to a defined value — matching upstream's `'value' in props`
// (`ToggleGroup.tsx:79-83`, with an explicit comment warning that `value !==
// undefined` is wrong: an empty selection is legitimately `undefined`, so
// that check would flip a controlled group to uncontrolled the moment its
// bound value clears, and resurface stale state). Vue's declared props are
// always present on the `props` object regardless of whether the caller
// bound them, so the presence check has to read the actual vnode props the
// parent passed instead of the resolved `props` object.
const instance = getCurrentInstance();
const isControlled = Boolean(
  instance && instance.vnode.props && 'value' in instance.vnode.props,
);
const internalValue = shallowRef(props.defaultValue);
const value = computed(() =>
  isControlled ? props.value : internalValue.value,
);

function setValue(next: string | string[] | undefined): void {
  if (!isControlled) internalValue.value = next;
  emit('update:value', next);
}

function toggleValue(itemValue: string): void {
  if (d.value.multiple) {
    const current = value.value;
    const list = Array.isArray(current)
      ? current
      : current != null
        ? [current]
        : [];
    setValue(
      list.includes(itemValue)
        ? list.filter((entry) => entry !== itemValue)
        : [...list, itemValue],
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
