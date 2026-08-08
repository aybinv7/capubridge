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

function close(): void {
  root?.setOpen(false);
}

// No-ops (renders the child as-is) when used outside a ToastRoot, like upstream.
const closeNode = computed(() =>
  root ? cloneTriggerNode(slots.default?.(), { onClick: close }) : undefined,
);
</script>

<template>
  <VNodeRenderer v-if="closeNode" :node="closeNode" />
  <slot v-else />
</template>
