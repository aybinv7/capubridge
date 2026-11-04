<script setup lang="ts">
import { computed, getCurrentInstance, shallowRef, useId } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import type { AccordionRootProps } from './accordion.contracts.ts';
import { provideAccordionContext } from './accordionContext.ts';

const props = withDefaults(defineProps<AccordionRootProps>(), {
  disabled: undefined,
  defaultValue: undefined,
  multiple: undefined,
  value: undefined,
});

const emit = defineEmits<{
  'update:value': [value: string | string[] | undefined];
}>();

defineSlots<{
  default?: () => unknown;
}>();

const d = useComponentDefaults('AccordionRoot', props, {
  disabled: false,
  multiple: false,
});
const baseId = useId();

// Controlled when the `value` prop is bound at all, not when it currently
// resolves to a defined value — matching upstream's `'value' in props`
// (`AccordionRoot.tsx:770-774`, with an explicit comment warning that `value
// !== undefined` is wrong: an "everything closed" selection is legitimately
// `undefined`, so that check would flip a controlled accordion to
// uncontrolled the moment it closes, and resurface stale state). Vue's
// declared props are always present on the `props` object regardless of
// whether the caller bound them, so the presence check has to read the
// actual vnode props the parent passed instead of the resolved `props`
// object.
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

function isItemOpen(itemValue: string): boolean {
  return Array.isArray(value.value)
    ? value.value.includes(itemValue)
    : value.value === itemValue;
}

function toggleItem(itemValue: string): void {
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
