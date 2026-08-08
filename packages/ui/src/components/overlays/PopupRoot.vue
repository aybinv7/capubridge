<script setup lang="ts">
import { popupRootContextKey } from "./overlayRootContext.ts";
import { useOverlayRoot, type OverlayRootProps } from "./overlayRoot.ts";

const props = withDefaults(defineProps<OverlayRootProps>(), {
  defaultOpen: false,
  open: undefined,
});

const emit = defineEmits<{
  "update:open": [open: boolean];
}>();

defineSlots<{
  default?: () => unknown;
}>();

useOverlayRoot(popupRootContextKey, props, (open) => emit("update:open", open));
</script>

<template>
  <slot />
</template>
