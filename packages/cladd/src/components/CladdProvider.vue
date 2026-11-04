<script setup lang="ts">
import { provideUiContext } from '../contexts/uiContext.ts';
import type { CladdProviderProps } from './claddProvider.contracts.ts';
import DialogsPortal from './DialogsPortal.vue';
import { provideDialogsPortalContext } from './dialogsPortalContext.ts';
import ToastsPortal from './ToastsPortal.vue';
import { provideToastsPortalContext } from './toastsPortalContext.ts';

/**
 * Upstream's `CladdProvider` renders **no DOM element** — it only publishes context. The
 * `dark`/`light` and `cladd-color-*` classes that drive the token cascade belong on the app's own
 * root element, exactly as a Cladd app does it:
 *
 * ```html
 * <html class="dark cladd-color-brand">
 * ```
 */

const props = withDefaults(defineProps<CladdProviderProps>(), {
  accentColor: 'brand',
  defaults: undefined,
  overlaysRoot: undefined,
  theme: 'dark',
});

defineSlots<{
  default?: () => unknown;
}>();

provideUiContext({
  accentColor: () => props.accentColor,
  defaults: () => props.defaults,
  overlaysRoot: () => props.overlaysRoot,
  theme: () => props.theme,
});

provideDialogsPortalContext();
provideToastsPortalContext();
</script>

<template>
  <slot />
  <DialogsPortal />
  <ToastsPortal />
</template>
