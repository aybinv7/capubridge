<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import { useFieldContext } from './fieldContext.ts';
import type { InputGroupProps } from './inputGroup.contracts.ts';
import { provideInputGroupContext } from './inputGroupContext.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<InputGroupProps>(), {
  as: undefined,
  disabled: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('InputGroup', props, {
  disabled: false,
});

const field = useFieldContext();
const groupId = useId();
const controlId = computed(
  () => field?.controlId.value ?? `${groupId}-control`,
);
const disabled = computed(
  () => d.value.disabled || field?.disabled.value || false,
);

provideInputGroupContext({ controlId, disabled });

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-input-group group/cladd-input-group flex items-stretch',
    disabled.value && 'opacity-70',
    attrs.class,
  ),
);
</script>

<template>
  <component
    :is="d.as ?? 'div'"
    v-bind="rootAttrs"
    :class="rootClass"
    :data-disabled="disabled || undefined"
    data-slot="input-group"
  >
    <slot />
  </component>
</template>
