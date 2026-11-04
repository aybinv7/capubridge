<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import Button from './Button.vue';
import { useFieldContext } from './fieldContext.ts';
import type { InputGroupButtonProps } from './inputGroup.contracts.ts';
import { useInputGroupContext } from './inputGroupContext.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<InputGroupButtonProps>(), {
  as: undefined,
  color: undefined,
  disabled: undefined,
  label: undefined,
  size: undefined,
  variant: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('InputGroupButton', props, {
  size: 'xs',
  variant: 'solid',
});

const field = useFieldContext();
const group = useInputGroupContext();
const disabled = computed(
  () =>
    d.value.disabled || group?.disabled.value || field?.disabled.value || false,
);

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() => cn('order-last shrink-0', attrs.class));
</script>

<template>
  <Button
    v-bind="rootAttrs"
    :aria-label="d.label"
    :class="rootClass"
    :color="d.color"
    data-slot="input-group-button"
    :disabled="disabled"
    :size="d.size === 'xs' ? 'xs' : 'sm'"
    :variant="d.variant"
  >
    <slot />
  </Button>
</template>
