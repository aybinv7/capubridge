<script setup lang="ts">
import { computed, type Component } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import type { SurfaceVariant, UiSize } from '../foundations/contracts.ts';
import { cn } from '../shared/cn.ts';
import { buttonIconSizes } from './button.contracts.ts';
import Button from './Button.vue';
import type { ListButtonProps } from './dataDisplay.contracts.ts';
import {
  listButtonAfterClasses,
  listButtonClasses,
  listButtonContentClasses,
  listButtonFooterClasses,
  listButtonHeaderClasses,
  listButtonIconClasses,
  listButtonInnerContentClasses,
  listButtonTitleClasses,
} from './list.contracts.ts';

const props = withDefaults(defineProps<ListButtonProps>(), {
  as: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  footer: undefined,
  footerClassName: undefined,
  header: undefined,
  headerClassName: undefined,
  iconClassName: undefined,
  innerContentClassName: undefined,
  outline: undefined,
  readOnly: undefined,
  rounded: undefined,
  selected: undefined,
  size: undefined,
  titleClassName: undefined,
  variant: undefined,
});

const d = useComponentDefaults('ListButton', props, {
  as: 'button' as string | Component,
  disabled: false,
  outline: false,
  readOnly: false,
  rounded: true,
  selected: false,
  size: 'lg' as UiSize,
  variant: 'transparent' as SurfaceVariant,
});

defineSlots<{
  after?: () => unknown;
  default?: () => unknown;
  footer?: () => unknown;
  header?: () => unknown;
  icon?: () => unknown;
}>();

const iconSizeClass = computed(() => buttonIconSizes[d.value.size]);
const rootClass = computed(() => cn(listButtonClasses));
const contentClass = computed(() =>
  cn(listButtonContentClasses, d.value.contentClassName),
);
const iconClass = computed(() =>
  cn(listButtonIconClasses, iconSizeClass.value, d.value.iconClassName),
);
const innerContentClass = computed(() =>
  cn(listButtonInnerContentClasses, d.value.innerContentClassName),
);
const headerClass = computed(() =>
  cn(listButtonHeaderClasses, d.value.headerClassName),
);
const titleClass = computed(() =>
  cn(listButtonTitleClasses, iconSizeClass.value, d.value.titleClassName),
);
const footerClass = computed(() =>
  cn(listButtonFooterClasses, d.value.footerClassName),
);
const afterClass = computed(() =>
  cn(listButtonAfterClasses, iconSizeClass.value),
);
</script>

<template>
  <Button
    :as="d.as"
    :class="rootClass"
    :color="d.color"
    :content-class-name="contentClass"
    :data-selected="d.selected || undefined"
    :disabled="d.disabled"
    multiline
    :outline="d.outline || d.selected"
    :read-only="d.readOnly"
    :rounded="d.rounded"
    :size="d.size"
    :variant="d.selected ? 'gradient' : d.variant"
  >
    <div v-if="$slots.icon" :class="iconClass" data-part="icon">
      <slot name="icon" />
    </div>
    <div
      v-if="
        $slots.default || d.footer || $slots.footer || d.header || $slots.header
      "
      :class="innerContentClass"
    >
      <div
        v-if="d.header || $slots.header"
        :class="headerClass"
        data-part="header"
      >
        <slot name="header">{{ d.header }}</slot>
      </div>
      <div :class="titleClass" data-part="title">
        <slot />
      </div>
      <div
        v-if="d.footer || $slots.footer"
        :class="footerClass"
        data-part="footer"
      >
        <slot name="footer">{{ d.footer }}</slot>
      </div>
    </div>
    <div v-if="$slots.after" :class="afterClass" data-part="after">
      <slot name="after" />
    </div>
  </Button>
</template>
