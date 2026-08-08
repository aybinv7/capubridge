<script setup lang="ts">
import { provideUiContext } from "../../contexts/uiContext.ts";
import type { ComponentDefaults } from "../../foundations/componentDefaults.ts";
import type { UiAccent, UiTheme } from "../../foundations/contracts.ts";
import DialogsPortal from "./DialogsPortal.vue";
import { provideDialogsPortalContext } from "./dialogsPortalContext.ts";
import ToastsPortal from "./ToastsPortal.vue";
import { provideToastsPortalContext } from "./toastsPortalContext.ts";

/**
 * Upstream's `CladdProvider` renders **no DOM element** — it only publishes context. The
 * `dark`/`light` and `cui-color-*` classes that drive the token cascade belong on the app's own
 * root element, exactly as a Cladd app does it:
 *
 * ```html
 * <html class="dark cui-color-brand">
 * ```
 */

const props = withDefaults(
  defineProps<{
    /** App-wide accent color. Read by `useAccentColor`. Default `'brand'`. */
    accentColor?: UiAccent;
    /** Per-component default props, applied app-wide. */
    defaults?: ComponentDefaults;
    /** Root element(s) to insert overlays into. Default `'#app, #__next, #root'`. */
    overlaysRoot?: string;
    /** Color scheme. Read by `useTheme`. Default `'dark'`. */
    theme?: UiTheme;
  }>(),
  {
    accentColor: "brand",
    defaults: undefined,
    overlaysRoot: undefined,
    theme: "dark",
  },
);

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
