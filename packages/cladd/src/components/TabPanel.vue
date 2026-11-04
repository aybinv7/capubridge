<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { TabPanelProps } from './tabs.contracts.ts';
import { tabId, tabPanelId, useTabsContext } from './tabsContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TabPanelProps>(), {
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
const { value: selectedValue, baseId } = useTabsContext();
const d = useComponentDefaults('TabPanel', props, {
  as: 'div' as NonNullable<TabPanelProps['as']>,
  keepMounted: false,
});
const selected = computed(() => selectedValue.value === d.value.value);
const rootClass = computed(() => cn('cladd-tab-panel', attrs.class));
</script>

<template>
  <component
    :is="d.as"
    v-if="selected || d.keepMounted"
    v-bind="rootAttrs"
    :id="tabPanelId(baseId, d.value)"
    :aria-labelledby="tabId(baseId, d.value)"
    :class="rootClass"
    :data-selected="selected || undefined"
    :hidden="!selected || undefined"
    role="tabpanel"
    tabindex="0"
  >
    <slot />
  </component>
</template>
