<script setup lang="ts">
import { useOverlayRoot, type OverlayRootProps } from './overlayRoot.ts';
import { popoverRootContextKey } from './overlayRootContext.ts';

const props = withDefaults(defineProps<OverlayRootProps>(), {
  defaultOpen: false,
  open: undefined,
});

const emit = defineEmits<{
  'update:open': [open: boolean];
}>();

defineSlots<{
  default?: () => unknown;
}>();

useOverlayRoot(popoverRootContextKey, props, (open) =>
  emit('update:open', open),
);
</script>

<template>
  <slot />
</template>
