<script setup lang="ts">
import { computed } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent, UiSize } from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import { nestedSizeClasses } from "../../shared/sizeClasses.ts";

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    color?: UiAccent;
    size?: UiSize;
  }>(),
  {
    accent: undefined,
    color: undefined,
    size: "sm",
  },
);

const ui = useUiContext();
const currentAccent = computed(() => props.color ?? props.accent ?? ui.accent.value);

const rootClass = computed(() =>
  cn(
    "cui-spinner relative inline-block",
    `cui-accent-${currentAccent.value}`,
    "text-cui-primary",
    nestedSizeClasses(props.size, "size"),
  ),
);
</script>

<template>
  <span :class="rootClass" :data-cui-size="props.size">
    <svg
      class="cui-spinner__glyph h-full w-full animate-cui-spinner"
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.045 2.078q-1.04.135-1.609.33a7.982 7.982 0 1 0 10.236 9.9q.15-.49.256-1.356c.069-.568.55-.997 1.122-.997h.008c.56 0 .995.486.937 1.041q-.113 1.068-.279 1.663c-1.18 4.233-5.064 7.338-9.674 7.338C4.496 19.997 0 15.501 0 9.955 0 5.382 3.058 1.522 7.24.31Q7.868.13 9 .006a.94.94 0 0 1 1.042.933v.008c0 .574-.428 1.058-.997 1.131"
      />
    </svg>
  </span>
</template>
