<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import type { FieldSize } from './form.contracts.ts';
import SearchIcon from './icons/SearchIcon.vue';
import Input from './Input.vue';
import {
  searchFieldClasses,
  searchFieldIconClasses,
  type SearchFieldProps,
} from './searchField.contracts.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SearchFieldProps>(), {
  as: undefined,
  autoFocus: undefined,
  clearButton: undefined,
  clearLabel: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  errorMessage: undefined,
  iconClassName: undefined,
  infoMessage: undefined,
  inputClassName: undefined,
  inputId: undefined,
  inputComponent: undefined,
  inputProps: undefined,
  inputMode: undefined,
  max: undefined,
  maxLength: undefined,
  min: undefined,
  name: undefined,
  pattern: undefined,
  placeholder: undefined,
  readOnly: undefined,
  required: undefined,
  rounded: undefined,
  size: undefined,
  step: undefined,
  tightFocusRing: undefined,
  type: undefined,
  valid: undefined,
  bgClassName: undefined,
  outline: undefined,
  hoverable: undefined,
  clickable: undefined,
  pressed: undefined,
  overlayPosition: undefined,
  overlayClassName: undefined,
  wrapContent: undefined,
});

const d = useComponentDefaults('SearchField', props, {
  clearButton: true,
  placeholder: 'Search',
  rounded: true,
  size: 'lg' as FieldSize,
});

defineSlots<{
  beforeContent?: () => unknown;
  displayValue?: () => unknown;
  error?: () => unknown;
  icon?: () => unknown;
  info?: () => unknown;
  prefix?: () => unknown;
  suffix?: () => unknown;
}>();

const emit = defineEmits<{
  change: [value: string, event: Event];
  clear: [];
  keydown: [event: KeyboardEvent];
}>();

const model = defineModel<string>({ default: '' });
const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() => cn(searchFieldClasses, attrs.class));

function clear(): void {
  model.value = '';
  emit('clear');
}

// Escape clears the field; only swallow it when there's something to clear so an empty field
// still lets Escape bubble (e.g. to close a Popover).
function onKeydown(event: KeyboardEvent): void {
  emit('keydown', event);
  if (event.defaultPrevented || event.key !== 'Escape' || !model.value) return;
  event.preventDefault();
  event.stopPropagation();
  clear();
}
</script>

<template>
  <Input
    v-bind="rootAttrs"
    v-model="model"
    :as="d.as"
    :auto-focus="d.autoFocus"
    :bg-class-name="d.bgClassName"
    :class="rootClass"
    :clear-button="d.clearButton"
    :clear-label="d.clearLabel"
    :clickable="d.clickable"
    :color="d.color"
    :content-class-name="d.contentClassName"
    :disabled="d.disabled"
    :error-message="d.errorMessage"
    :hoverable="d.hoverable"
    :icon-class-name="d.iconClassName"
    :info-message="d.infoMessage"
    :input-class-name="d.inputClassName"
    :input-component="d.inputComponent"
    :input-id="d.inputId"
    :input-props="d.inputProps"
    :input-mode="d.inputMode"
    :max="d.max"
    :max-length="d.maxLength"
    :min="d.min"
    :name="d.name"
    :outline="d.outline"
    :overlay-class-name="d.overlayClassName"
    :overlay-position="d.overlayPosition"
    :pattern="d.pattern"
    :placeholder="d.placeholder"
    :pressed="d.pressed"
    :read-only="d.readOnly"
    :required="d.required"
    :rounded="d.rounded"
    :size="d.size"
    :step="d.step"
    :tight-focus-ring="d.tightFocusRing"
    :type="d.type"
    :valid="d.valid"
    :wrap-content="d.wrapContent"
    @change="(value, event) => emit('change', value, event)"
    @clear="clear"
    @keydown="onKeydown"
  >
    <template v-if="$slots.beforeContent" #beforeContent>
      <slot name="beforeContent" />
    </template>
    <template #icon>
      <slot name="icon">
        <SearchIcon :class="searchFieldIconClasses" />
      </slot>
    </template>
    <template v-if="$slots.info" #info>
      <slot name="info" />
    </template>
    <template v-if="$slots.error" #error>
      <slot name="error" />
    </template>
    <template v-if="$slots.prefix" #prefix>
      <slot name="prefix" />
    </template>
    <template v-if="$slots.suffix" #suffix>
      <slot name="suffix" />
    </template>
    <template v-if="$slots.displayValue" #displayValue>
      <slot name="displayValue" />
    </template>
  </Input>
</template>
