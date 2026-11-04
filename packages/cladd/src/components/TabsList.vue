<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { SegmentedProps } from './segmented.contracts.ts';
import Segmented from './Segmented.vue';
import { useTabsContext } from './tabsContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<SegmentedProps & { className?: string }>(),
  {
    as: undefined,
    activeColor: undefined,
    activeOutline: undefined,
    activeVariant: undefined,
    color: undefined,
    disabled: undefined,
    outline: undefined,
    rounded: undefined,
    size: undefined,
    variant: undefined,
    className: undefined,
  },
);

defineSlots<{
  default?: () => unknown;
}>();

const d = useComponentDefaults('TabsList', props, {});

const attrs = useAttrs();
const forwardProps = computed(() => {
  const { className: _className, ...rest } = d.value as Record<string, unknown>;
  return rest as Omit<SegmentedProps, 'as'> & Record<string, unknown>;
});
const forwardAttrs = computed(() => {
  const { class: _class, ...rest } = attrs as Record<string, unknown>;
  return rest;
});
const forwardClass = computed(() =>
  cn((d.value as { className?: string }).className, attrs.class),
);

const { setValue } = useTabsContext();

function onTabsKeydown(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

  const container = event.currentTarget as HTMLElement;
  const tabs = Array.from(
    container.querySelectorAll<HTMLElement>('[role="tab"]'),
  ).filter((tab) => tab.getAttribute('data-disabled') == null);
  if (tabs.length === 0) return;

  const active = document.activeElement as HTMLElement | null;
  const currentIndex = active ? tabs.indexOf(active) : -1;

  let nextIndex: number;
  switch (event.key) {
    case 'ArrowRight':
      nextIndex = (currentIndex + 1 + tabs.length) % tabs.length;
      break;
    case 'ArrowLeft':
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      break;
    case 'Home':
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
    v-bind="{ ...forwardProps, ...forwardAttrs }"
    :class="forwardClass"
    aria-orientation="horizontal"
    role="tablist"
    @keydown="onTabsKeydown"
  >
    <slot />
  </Segmented>
</template>
