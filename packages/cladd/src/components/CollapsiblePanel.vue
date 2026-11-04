<script setup lang="ts">
import { computed, onMounted, shallowRef, useAttrs, watch } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { CollapsiblePanelProps } from './collapsible.contracts.ts';
import { useCollapsibleContext } from './collapsibleContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CollapsiblePanelProps>(), {
  as: undefined,
  keepMounted: undefined,
});

defineSlots<{
  default?: () => unknown;
}>();

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const collapsible = useCollapsibleContext();
const d = useComponentDefaults('CollapsiblePanel', props, {
  as: 'div' as NonNullable<CollapsiblePanelProps['as']>,
  keepMounted: false,
});

const element = shallowRef<HTMLElement>();
const rendered = shallowRef(collapsible.value.open || d.value.keepMounted);
let mounted = false;
let previousOpen = collapsible.value.open;

const rootClass = computed(() =>
  cn(
    'cladd-collapsible-panel box-border block overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none',
    attrs.class,
  ),
);

function setElement(value: unknown): void {
  element.value =
    value instanceof HTMLElement
      ? value
      : value && typeof value === 'object' && '$el' in value
        ? ((value as { $el: unknown }).$el as HTMLElement)
        : undefined;
}

watch(
  () => collapsible.value.open,
  (open) => {
    if (open && !rendered.value) rendered.value = true;
  },
);

onMounted(() => {
  mounted = true;
});

watch(
  [() => collapsible.value.open, rendered, element],
  ([open]) => {
    const el = element.value;
    if (!el) return;

    if (!mounted) {
      previousOpen = open;
      el.style.height = open ? 'auto' : '0px';
      return;
    }

    if (previousOpen === open) return;
    previousOpen = open;

    const reduce =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onEnd = (event: TransitionEvent): void => {
      if (event.target !== el || event.propertyName !== 'height') return;
      el.removeEventListener('transitionend', onEnd);
      if (open) el.style.height = 'auto';
      else if (!d.value.keepMounted) rendered.value = false;
    };

    if (open) {
      const target = el.scrollHeight;
      if (reduce || target === 0) {
        el.style.height = 'auto';
        return;
      }
      el.style.height = '0px';
      void el.offsetHeight;
      el.addEventListener('transitionend', onEnd);
      requestAnimationFrame(() => {
        el.style.height = `${target}px`;
      });
    } else {
      const current = el.scrollHeight;
      if (reduce || current === 0) {
        el.style.height = '0px';
        if (!d.value.keepMounted) rendered.value = false;
        return;
      }
      el.style.height = `${current}px`;
      void el.offsetHeight;
      el.addEventListener('transitionend', onEnd);
      requestAnimationFrame(() => {
        el.style.height = '0px';
      });
    }
  },
  { flush: 'post' },
);
</script>

<template>
  <component
    :is="d.as"
    v-if="rendered"
    :ref="setElement"
    v-bind="rootAttrs"
    :id="collapsible.panelId"
    :aria-labelledby="collapsible.triggerId"
    :class="rootClass"
    :data-open="collapsible.open || undefined"
    :inert="!collapsible.open || undefined"
    role="region"
  >
    <slot />
  </component>
</template>
