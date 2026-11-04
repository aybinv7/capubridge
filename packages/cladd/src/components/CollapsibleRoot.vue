<script setup lang="ts">
import { computed, shallowRef, useId } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import type { CollapsibleRootProps } from './collapsible.contracts.ts';
import { provideCollapsibleContext } from './collapsibleContext.ts';

const props = withDefaults(defineProps<CollapsibleRootProps>(), {
  disabled: undefined,
  defaultOpen: undefined,
  open: undefined,
});

const emit = defineEmits<{
  'update:open': [open: boolean];
}>();

defineSlots<{
  default?: () => unknown;
}>();

const d = useComponentDefaults('CollapsibleRoot', props, {
  disabled: false,
  defaultOpen: false,
});
const baseId = useId();
const internalOpen = shallowRef(d.value.defaultOpen);
const isControlled = computed(() => d.value.open !== undefined);
const open = computed(() =>
  isControlled.value ? (d.value.open ?? false) : internalOpen.value,
);

function setOpen(next: boolean): void {
  if (d.value.disabled || next === open.value) return;
  if (!isControlled.value) internalOpen.value = next;
  emit('update:open', next);
}

provideCollapsibleContext(
  computed(() => ({
    disabled: d.value.disabled,
    open: open.value,
    panelId: `${baseId}-panel`,
    setOpen,
    toggle: () => setOpen(!open.value),
    triggerId: `${baseId}-trigger`,
  })),
);
</script>

<template>
  <slot />
</template>
