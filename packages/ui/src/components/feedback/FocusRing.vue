<script setup lang="ts">
import { computed } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import { focusRingGroupClasses, type FocusRingGroup } from "./focusRing.contracts.ts";

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    color?: UiAccent;
    force?: boolean;
    group?: FocusRingGroup;
    offset?: boolean;
  }>(),
  {
    accent: undefined,
    color: undefined,
    force: false,
    group: undefined,
    offset: true,
  },
);

const ui = useUiContext();
const currentAccent = computed(() => props.color ?? props.accent ?? ui.accent.value);
const groupClasses = computed(() =>
  props.group ? (focusRingGroupClasses[props.group] ?? "") : "",
);

const ringClass = computed(() =>
  cn(
    "cui-focus-ring pointer-events-none absolute z-1 scale-95 border-2 border-cui-primary opacity-0 duration-200",
    props.offset ? "-inset-1.5" : "inset-0",
    `cui-accent-${currentAccent.value}`,
    props.force && "scale-100 opacity-100",
    !props.force && groupClasses.value,
  ),
);
</script>

<template>
  <span :class="ringClass" data-part="focus-ring" />
</template>
