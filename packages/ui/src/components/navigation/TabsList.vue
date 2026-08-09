<script setup lang="ts">
import Segmented from "../actions/Segmented.vue";
import type { SegmentedProps } from "../actions/segmented.contracts.ts";
import { useTabsContext } from "./tabsContext.ts";

defineOptions({ inheritAttrs: false });

const props = defineProps<SegmentedProps>();

defineSlots<{
  default?: () => unknown;
}>();

const { setValue } = useTabsContext();

function onTabsKeydown(event: KeyboardEvent): void {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

  const container = event.currentTarget as HTMLElement;
  const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
    (tab) => tab.getAttribute("data-disabled") == null,
  );
  if (tabs.length === 0) return;

  const active = document.activeElement as HTMLElement | null;
  const currentIndex = active ? tabs.indexOf(active) : -1;

  let nextIndex: number;
  switch (event.key) {
    case "ArrowRight":
      nextIndex = (currentIndex + 1 + tabs.length) % tabs.length;
      break;
    case "ArrowLeft":
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      break;
    case "Home":
      nextIndex = 0;
      break;
    default:
      nextIndex = tabs.length - 1;
  }

  event.preventDefault();
  const next = tabs[nextIndex];
  if (next?.dataset.value != null) setValue(next.dataset.value);
  next?.focus();
}
</script>

<template>
  <Segmented
    v-bind="{ ...props, ...$attrs }"
    aria-orientation="horizontal"
    role="tablist"
    @keydown="onTabsKeydown"
  >
    <slot />
  </Segmented>
</template>
