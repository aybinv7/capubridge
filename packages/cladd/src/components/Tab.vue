<script setup lang="ts">
import { computed } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import type { ButtonProps } from './button.contracts.ts';
import SegmentedButton from './SegmentedButton.vue';
import type { TabProps } from './tabs.contracts.ts';
import { tabId, tabPanelId, useTabsContext } from './tabsContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ButtonProps & TabProps>(), {
  as: undefined,
  clickable: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  focusable: undefined,
  focused: undefined,
  hoverable: undefined,
  loading: undefined,
  multiline: undefined,
  outline: undefined,
  pressed: undefined,
  readOnly: undefined,
  rounded: undefined,
  size: undefined,
  square: undefined,
  surface: undefined,
  surfaceLevel: undefined,
  tightFocusRing: undefined,
  variant: undefined,
});

defineSlots<{
  default?: () => unknown;
}>();

const d = useComponentDefaults('Tab', props, {});
const { value: selectedValue, setValue, baseId } = useTabsContext();
const selected = computed(() => selectedValue.value === d.value.value);

function onClick(): void {
  setValue(d.value.value);
}
</script>

<template>
  <SegmentedButton
    v-bind="$attrs"
    :active="selected"
    :aria-controls="tabPanelId(baseId, d.value)"
    :aria-selected="selected"
    :as="d.as"
    :clickable="d.clickable"
    :color="d.color"
    :content-class-name="d.contentClassName"
    :data-value="d.value"
    :disabled="d.disabled"
    :focusable="d.focusable"
    :focused="d.focused"
    :hoverable="d.hoverable"
    :id="tabId(baseId, d.value)"
    :loading="d.loading"
    :multiline="d.multiline"
    :outline="d.outline"
    :pressed="d.pressed"
    :read-only="false"
    role="tab"
    :rounded="d.rounded"
    :size="d.size"
    :square="d.square"
    :surface="d.surface"
    :surface-level="d.surfaceLevel"
    :tabindex="selected ? 0 : -1"
    :tight-focus-ring="d.tightFocusRing"
    :variant="d.variant"
    @click="onClick"
  >
    <slot />
  </SegmentedButton>
</template>
