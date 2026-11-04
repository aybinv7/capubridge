<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { AccordionItemProps } from './accordion.contracts.ts';
import { useAccordionContext } from './accordionContext.ts';
import { provideCollapsibleContext } from './collapsibleContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AccordionItemProps>(), {
  disabled: undefined,
});

defineSlots<{
  default?: () => unknown;
}>();

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const accordion = useAccordionContext();
const d = useComponentDefaults('AccordionItem', props, {
  disabled: false,
});

const disabled = computed(() => accordion.value.disabled || d.value.disabled);
const open = computed(() => accordion.value.isItemOpen(d.value.value));

function setOpen(next: boolean): void {
  if (disabled.value || next === open.value) return;
  accordion.value.toggleItem(d.value.value);
}

provideCollapsibleContext(
  computed(() => ({
    disabled: disabled.value,
    open: open.value,
    panelId: `${accordion.value.baseId}-panel-${d.value.value}`,
    setOpen,
    toggle: () => {
      if (!disabled.value) accordion.value.toggleItem(d.value.value);
    },
    triggerId: `${accordion.value.baseId}-trigger-${d.value.value}`,
  })),
);

const rootClass = computed(() => cn('cladd-accordion-item', attrs.class));
</script>

<template>
  <div
    v-bind="rootAttrs"
    :class="rootClass"
    :data-disabled="disabled || undefined"
    :data-open="open || undefined"
  >
    <slot />
  </div>
</template>
