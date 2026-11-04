<script setup lang="ts">
import { computed, useSlots } from 'vue';

import { useCollapsibleContext } from './collapsibleContext.ts';
import { cloneTriggerNode } from './overlayTrigger.ts';
import VNodeRenderer from './VNodeRenderer.ts';

defineSlots<{
  default?: () => unknown;
}>();

const slots = useSlots();
const collapsible = useCollapsibleContext();

function onClick(): void {
  if (!collapsible.value.disabled) collapsible.value.toggle();
}

const triggerNode = computed(() =>
  cloneTriggerNode(slots.default?.(), {
    'aria-controls': collapsible.value.panelId,
    'aria-disabled': collapsible.value.disabled || undefined,
    'data-disabled': collapsible.value.disabled || undefined,
    'data-open': collapsible.value.open || undefined,
    'aria-expanded': collapsible.value.open,
    id: collapsible.value.triggerId,
    onClick,
  }),
);
</script>

<template>
  <VNodeRenderer :node="triggerNode" />
</template>
