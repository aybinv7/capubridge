<script setup lang="ts">
import { computed, onBeforeUnmount, useAttrs, useId } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { FieldDescriptionProps } from './field.contracts.ts';
import { useFieldContext } from './fieldContext.ts';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?: () => unknown;
}>();

const props = withDefaults(defineProps<FieldDescriptionProps>(), {
  as: undefined,
  descriptionId: undefined,
});

const attrs = useAttrs();
const d = useComponentDefaults('FieldDescription', props, {});

const field = useFieldContext();
if (!field) {
  throw new Error(
    'cladd-vue: `FieldDescription` must be used inside a `Field`.',
  );
}

const baseId = useId();
const descriptionId = computed(
  () => props.descriptionId ?? `${baseId}-description`,
);
field.registerDescription(descriptionId.value);
onBeforeUnmount(() => {
  field.unregisterDescription(descriptionId.value);
});

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() =>
  cn(
    'cladd-field-description text-cladd-2xs text-cladd-fg-softer',
    attrs.class,
  ),
);
</script>

<template>
  <component
    :is="d.as ?? 'p'"
    v-bind="rootAttrs"
    :id="descriptionId"
    :class="rootClass"
    data-slot="field-description"
  >
    <slot />
  </component>
</template>
