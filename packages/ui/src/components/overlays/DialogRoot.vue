<script setup lang="ts">
import { dialogRootContextKey } from "./overlayRootContext.ts";
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

useOverlayRoot(dialogRootContextKey, props, (open) => emit("update:open", open));
</script>

<template>
  <slot />
</template>
