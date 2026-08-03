<script setup lang="ts">
import { computed } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent, UiSize } from "../../foundations/contracts.ts";

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    force?: boolean;
    multiline?: boolean;
    offset?: boolean;
    rounded?: boolean;
    size?: UiSize;
  }>(),
  {
    accent: undefined,
    force: false,
    multiline: false,
    offset: true,
    rounded: false,
    size: "md",
  },
);

const ui = useUiContext();
const currentAccent = computed(() => props.accent ?? ui.accent.value);
</script>

<template>
  <span
    class="cui-focus-ring"
    :class="[
      `cui-accent-${currentAccent}`,
      props.force && 'cui-focus-ring--forced',
      props.multiline && 'cui-focus-ring--multiline',
      props.offset && 'cui-focus-ring--offset',
      props.rounded && 'cui-focus-ring--rounded',
    ]"
    data-part="focus-ring"
    :data-cui-size="props.size"
  />
</template>
