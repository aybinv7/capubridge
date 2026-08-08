<script setup lang="ts">
import { computed } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
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
    force: undefined,
    group: undefined,
    offset: undefined,
  },
);

const ui = useUiContext();
const d = useComponentDefaults("FocusRing", props, { force: false, offset: true });
const currentAccent = computed(() => d.value.color ?? d.value.accent ?? ui.accentColor.value);
const groupClasses = computed(() =>
  d.value.group ? (focusRingGroupClasses[d.value.group] ?? "") : "",
);

const ringClass = computed(() =>
  cn(
    "cui-focus-ring pointer-events-none absolute z-1 scale-95 border-2 border-cui-primary opacity-0 duration-200",
    d.value.offset ? "-inset-1.5" : "inset-0",
    `cui-color-${currentAccent.value}`,
    d.value.force && "scale-100 opacity-100",
    !d.value.force && groupClasses.value,
  ),
);
</script>

<template>
  <span :class="ringClass" data-part="focus-ring" />
</template>
