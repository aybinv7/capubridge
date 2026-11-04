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

function close(): void {
  root?.setOpen(false);
}

// No-ops (renders the child as-is) when used outside a DialogRoot, like upstream.
const closeNode = computed(() =>
  root ? cloneTriggerNode(slots.default?.(), { onClick: close }) : undefined,
);
</script>

<template>
  <VNodeRenderer v-if="closeNode" :node="closeNode" />
  <slot v-else />
</template>
