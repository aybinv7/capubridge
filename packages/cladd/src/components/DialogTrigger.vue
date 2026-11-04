<script setup lang="ts">
import { computed, useSlots } from 'vue';

import {
  dialogRootContextKey,
  useOverlayRootContext,
} from './overlayRootContext.ts';
import { cloneTriggerNode } from './overlayTrigger.ts';
import VNodeRenderer from './VNodeRenderer.ts';

defineSlots<{
  default?: () => unknown;
}>();

const slots = useSlots();
const root = useOverlayRootContext(dialogRootContextKey);

function toggle(): void {
  if (!root) return;
  root.setOpen(!root.open.value);
}

// Unlike PopoverTrigger this registers no anchor — dialogs are centered on the viewport.
// No-ops (renders the child as-is) when used outside a DialogRoot, like upstream.
const triggerNode = computed(() =>
  root ? cloneTriggerNode(slots.default?.(), { onClick: toggle }) : undefined,
);
</script>

<template>
  <VNodeRenderer v-if="triggerNode" :node="triggerNode" />
  <slot v-else />
</template>
