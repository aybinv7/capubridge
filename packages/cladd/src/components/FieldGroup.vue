<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { FieldGroupProps } from './field.contracts.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<FieldGroupProps>(), {
  as: undefined,
  label: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('FieldGroup', props, {
  label: '',
});

const groupId = useId();
const labelledBy = computed(() =>
  d.value.label ? `${groupId}-title` : undefined,
);
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn('cladd-field-group flex flex-col gap-4', attrs.class),
);
</script>

<template>
  <component
    :is="d.as ?? 'div'"
    v-bind="rootAttrs"
    :aria-labelledby="labelledBy"
    :class="rootClass"
    data-slot="field-group"
    role="group"
  >
    <slot />
  </component>
</template>
