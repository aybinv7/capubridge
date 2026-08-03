<script setup lang="ts">
import { computed, type Component } from "vue";

import { provideUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent, UiTheme } from "../../foundations/contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    as?: string | Component;
    theme?: UiTheme;
  }>(),
  {
    accent: "brand",
    as: "div",
    theme: "dark",
  },
);

const theme = computed(() => props.theme);
const accent = computed(() => props.accent);

provideUiContext(theme, accent);
</script>

<template>
  <component
    :is="props.as"
    v-bind="$attrs"
    class="cui-theme"
    :class="`cui-accent-${props.accent}`"
    :data-cui-theme="props.theme"
    :data-cui-accent="props.accent"
  >
    <slot />
  </component>
</template>
