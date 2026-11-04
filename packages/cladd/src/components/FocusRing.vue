<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { useUiContext } from '../contexts/uiContext.ts';
import { cn } from '../shared/cn.ts';
import type { Color } from '../types.ts';
import {
  focusRingGroupClasses,
  type FocusRingGroup,
} from './focusRing.contracts.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    color?: Color;
    force?: boolean;
    group?: FocusRingGroup;
    offset?: boolean;
  }>(),
  {
    color: undefined,
    force: undefined,
    group: undefined,
    offset: undefined,
  },
);

const ui = useUiContext();
const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const d = useComponentDefaults('FocusRing', props, {
  force: false,
  offset: true,
});
const currentAccent = computed(() => d.value.color ?? ui.accentColor.value);
const groupClasses = computed(() =>
  d.value.group ? (focusRingGroupClasses[d.value.group] ?? '') : '',
);

const ringClass = computed(() =>
  cn(
    'cladd-focus-ring pointer-events-none absolute z-1 scale-95 border-2 border-cladd-primary opacity-0 duration-200',
    d.value.offset ? '-inset-1.5' : 'inset-0',
    `cladd-color-${currentAccent.value}`,
    d.value.force && 'scale-100 opacity-100',
    !d.value.force && groupClasses.value,
    attrs.class,
  ),
);
</script>

<template>
  <span v-bind="rootAttrs" :class="ringClass" data-part="focus-ring" />
</template>
