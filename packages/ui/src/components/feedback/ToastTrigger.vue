<script setup lang="ts">
import { computed, useSlots } from "vue";

import { toastRootContextKey, useOverlayRootContext } from "../overlays/overlayRootContext.ts";
import { cloneTriggerNode } from "../overlays/overlayTrigger.ts";
import VNodeRenderer from "../data-display/VNodeRenderer.ts";

defineSlots<{
  default?: () => unknown;
}>();

const slots = useSlots();
const root = useOverlayRootContext(toastRootContextKey);

function toggle(): void {
  if (!root) return;
  root.setOpen(!root.open.value);
}

// Unlike PopoverTrigger this registers no anchor — toasts are fixed to the viewport corner.
// No-ops (renders the child as-is) when used outside a ToastRoot, like upstream.
const triggerNode = computed(() =>
  root ? cloneTriggerNode(slots.default?.(), { onClick: toggle }) : undefined,
);
</script>

<template>
  <VNodeRenderer v-if="triggerNode" :node="triggerNode" />
  <slot v-else />
</template>
