<script setup lang="ts">
import { computed, ref, useAttrs, watch } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import type { SurfaceVariant } from '../foundations/contracts.ts';
import { cn } from '../shared/cn.ts';
import { roundedClasses } from '../shared/roundedClasses.ts';
import Button from './Button.vue';
import type { FieldSize } from './form.contracts.ts';
import Input from './Input.vue';
import {
  numberFieldPaddings,
  type NumberFieldProps,
  type NumberFieldSize,
} from './numberField.contracts.ts';
import Surface from './Surface.vue';
import SurfaceCut from './SurfaceCut.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldProps>(), {
  buttonOutline: undefined,
  buttonVariant: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  input: undefined,
  inputClassName: undefined,
  max: undefined,
  min: undefined,
  outline: undefined,
  readOnly: undefined,
  rounded: undefined,
  size: undefined,
  step: undefined,
  surfaceLevel: undefined,
  valueRounded: undefined,
  variant: undefined,
});

/** Default `0`. */
const model = defineModel<number>({ default: 0 });

const emit = defineEmits<{
  /** Fires after a +/− button press, with the new value (already clamped to `[min, max]`). */
  change: [value: number];
}>();

const d = useComponentDefaults('NumberField', props, {
  buttonOutline: false,
  buttonVariant: 'transparent' as SurfaceVariant,
  disabled: false,
  input: true,
  max: 1000000,
  min: 0,
  outline: true,
  readOnly: false,
  rounded: true,
  size: 'md' as NumberFieldSize,
  step: 1,
  valueRounded: false,
  variant: 'gradient' as SurfaceVariant,
});

defineSlots<{
  /** Custom content rendered inside the number field container (rare - most usage is value-only). */
  default?: () => unknown;
}>();

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

const draft = ref(String(model.value));
const inputRef = ref<{ inputElement?: HTMLInputElement }>();
let cancelling = false;

watch(model, (next) => (draft.value = String(next)));

function setValue(next: number): void {
  model.value = next;
  emit('change', next);
}

function commitDraft(): void {
  if (cancelling) {
    cancelling = false;
    return;
  }

  const parsed = Number(draft.value);
  if (draft.value === '' || Number.isNaN(parsed)) {
    draft.value = String(model.value);
    return;
  }

  const snapped =
    d.value.min +
    Math.round((parsed - d.value.min) / d.value.step) * d.value.step;
  const clamped = Math.min(d.value.max, Math.max(d.value.min, snapped));
  draft.value = String(clamped);
  if (clamped !== model.value) setValue(clamped);
}

function cancelDraft(): void {
  cancelling = true;
  draft.value = String(model.value);
}

function decrease(): void {
  if (model.value <= d.value.min || d.value.disabled) return;
  setValue(Math.max(d.value.min, model.value - d.value.step));
}

function increase(): void {
  if (model.value >= d.value.max || d.value.disabled) return;
  setValue(Math.min(d.value.max, model.value + d.value.step));
}

function onInputKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    inputRef.value?.inputElement?.blur();
  } else if (event.key === 'Escape') {
    cancelDraft();
    inputRef.value?.inputElement?.blur();
  }
}

const valueRadii = computed(() =>
  roundedClasses(d.value.size, d.value.valueRounded, false),
);
const wrapRadii = computed(() =>
  roundedClasses(d.value.size, d.value.rounded, false),
);

const isFill = computed(
  () => d.value.variant === 'solid-fill' || d.value.variant === 'gradient-fill',
);

const buttonVariant = computed(() => {
  const variant = d.value.buttonVariant;
  if (!isFill.value || !variant || variant.includes('fill')) return variant;
  return variant === 'transparent' || variant === 'solid'
    ? 'solid-fill'
    : 'gradient-fill';
});

const rootClass = computed(() =>
  cn(
    'cladd-number-field flex items-center gap-0.5',
    wrapRadii.value.wrapRoundedClasses,
    attrs.class,
  ),
);
const contentClass = computed(() =>
  cn('flex w-full items-center p-1', d.value.contentClassName),
);
const buttonClass = computed(() =>
  cn(d.value.size === 'xl' && 'min-w-11', d.value.size === '2xl' && 'min-w-13'),
);
const controlClass = computed(() =>
  cn(
    'min-w-9 text-center',
    isFill.value && 'text-cladd-fg',
    d.value.inputClassName,
  ),
);
const readOnlyControlClass = computed(() =>
  cn(
    'w-full min-w-9 self-stretch text-center',
    valueRadii.value.itemRoundedClasses,
  ),
);
const readOnlyContentClass = computed(() =>
  cn(
    'flex items-center justify-center text-cladd-xs',
    numberFieldPaddings[d.value.size],
  ),
);
</script>

<template>
  <Surface
    v-bind="rootAttrs"
    :class="rootClass"
    :color="d.color"
    :content-class-name="contentClass"
    :data-disabled="d.disabled || undefined"
    :data-readonly="d.readOnly || undefined"
    :level="d.surfaceLevel"
    :outline="d.outline"
    :variant="d.variant"
  >
    <Button
      :class="buttonClass"
      :color="d.color"
      data-part="decrease"
      :disabled="model <= d.min || d.disabled"
      :outline="d.buttonOutline"
      :read-only="d.readOnly"
      :rounded="d.rounded"
      :size="d.size"
      :variant="buttonVariant"
      @click="decrease"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 18 18"
      >
        <g fill="currentColor">
          <path
            d="M14.75,9.75H3.25c-.414,0-.75-.336-.75-.75s.336-.75,.75-.75H14.75c.414,0,.75,.336,.75,.75s-.336,.75-.75,.75Z"
          />
        </g>
      </svg>
    </Button>

    <Input
      v-if="d.input"
      ref="inputRef"
      v-model="draft"
      class="w-full min-w-0 shrink"
      data-part="control"
      :disabled="d.disabled"
      :input-class-name="controlClass"
      :read-only="d.readOnly"
      :rounded="d.valueRounded"
      :size="d.size as FieldSize"
      type="number"
      @blur="commitDraft"
      @keydown="onInputKeydown"
    />
    <SurfaceCut
      v-else
      :class="readOnlyControlClass"
      :content-class-name="readOnlyContentClass"
      data-part="control"
    >
      {{ model }}
    </SurfaceCut>

    <Button
      :class="buttonClass"
      :color="d.color"
      data-part="increase"
      :disabled="model >= d.max || d.disabled"
      :outline="d.buttonOutline"
      :read-only="d.readOnly"
      :rounded="d.rounded"
      :size="d.size"
      :variant="buttonVariant"
      @click="increase"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 18 18"
      >
        <g fill="currentColor">
          <path
            d="M14.75,9.75H3.25c-.414,0-.75-.336-.75-.75s.336-.75,.75-.75H14.75c.414,0,.75,.336,.75,.75s-.336,.75-.75,.75Z"
          />
          <path
            d="M9,15.5c-.414,0-.75-.336-.75-.75V3.25c0-.414,.336-.75,.75-.75s.75,.336,.75,.75V14.75c0,.414-.336,.75-.75,.75Z"
          />
        </g>
      </svg>
    </Button>
    <slot />
  </Surface>
</template>
