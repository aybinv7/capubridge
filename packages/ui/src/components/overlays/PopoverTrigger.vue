<script setup lang="ts">
import { computed, useSlots } from "vue";

import { resolveOverlayElement } from "./overlay.contracts.ts";
import { popoverRootContextKey, useOverlayRootContext } from "./overlayRootContext.ts";
import { cloneTriggerNode } from "./overlayTrigger.ts";
import VNodeRenderer from "../data-display/VNodeRenderer.ts";

defineSlots<{
  default?: () => unknown;
}>();

const slots = useSlots();
const root = useOverlayRootContext(popoverRootContextKey);

function setAnchor(value: unknown): void {
  if (!root) return;
  root.anchor.value = resolveOverlayElement(value);
}

function toggle(): void {
  if (!root) return;
  root.setOpen(!root.open.value);
}

// No-ops (renders the child as-is) when used outside a PopoverRoot, like upstream.
const triggerNode = computed(() =>
  root ? cloneTriggerNode(slots.default?.(), { onClick: toggle, ref: setAnchor }) : undefined,
);
</script>

<template>
  <VNodeRenderer v-if="triggerNode" :node="triggerNode" />
  <slot v-else />
</template>
