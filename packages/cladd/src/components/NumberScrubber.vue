<script setup lang="ts">
import { computed, nextTick, ref, useAttrs, useSlots, watch } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import type { SurfaceVariant } from '../foundations/contracts.ts';
import { cn } from '../shared/cn.ts';
import { buttonIconSizes } from './button.contracts.ts';
import Button from './Button.vue';
import type { FieldSize } from './form.contracts.ts';
import DropdownIcon from './icons/DropdownIcon.vue';
import Input from './Input.vue';
import {
  numberScrubberClickSuppressMs,
  type NumberScrubberProps,
  type NumberScrubberSize,
} from './numberScrubber.contracts.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberScrubberProps>(), {
  altDragStep: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  displayValue: undefined,
  dragStep: undefined,
  iconClassName: undefined,
  inputClassName: undefined,
  max: undefined,
  min: undefined,
  outline: undefined,
  readOnly: undefined,
  rounded: undefined,
  scrubberIcon: undefined,
  size: undefined,
  step: undefined,
  surfaceLevel: undefined,
  variant: undefined,
});

/** Current value. Default `0`. */
const model = defineModel<number>({ default: 0 });

const emit = defineEmits<{
  /** Fires once a drag ends (or after Enter/blur in edit mode), with the final value (already clamped to `[min, max]`). */
  change: [value: number];
  /** Fires continuously during drag with the in-progress value (already clamped to `[min, max]`). Useful for live previewing the change without committing it to controlled state. */
  temporaryChange: [value: number];
}>();

const d = useComponentDefaults('NumberScrubber', props, {
  disabled: false,
  max: 1000000,
  min: 0,
  outline: true,
  readOnly: false,
  rounded: false,
  scrubberIcon: true,
  size: 'md' as NumberScrubberSize,
  step: 1,
  variant: 'gradient' as SurfaceVariant,
});

const slots = defineSlots<{
  /** Optional content rendered after the formatted value (e.g. badges, suffix nodes). */
  default?: () => unknown;
  /** Icon node rendered inside the trigger - forwarded to the inner `Input` when editing and rendered as the first child of the idle `Button`. */
  icon?: () => unknown;
}>();

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

const isEditing = ref(false);
const inputValue = ref(String(model.value));
const displayElement = ref<HTMLSpanElement>();
const inputRef = ref<{ inputElement?: HTMLInputElement }>();
let pointerDownAt = 0;
let dragEndedAt = 0;

const dragStep = computed(() => d.value.dragStep ?? d.value.step / 5);
const altDragStep = computed(() => d.value.altDragStep ?? d.value.step);
const format = computed(
  () => d.value.displayValue ?? ((value: number) => String(value)),
);
const displayed = computed(() => format.value(model.value));

function roundToStep(value: number): number {
  return Number((Math.round(value / d.value.step) * d.value.step).toFixed(10));
}

function clamp(value: number): number {
  return Math.max(d.value.min, Math.min(d.value.max, value));
}

function enableEditing(): void {
  inputValue.value = String(model.value);
  isEditing.value = true;
}

function commitInput(): void {
  isEditing.value = false;
  const parsed = Number.parseFloat(inputValue.value);
  if (Number.isNaN(parsed)) return;

  const rounded = roundToStep(clamp(parsed));
  if (rounded !== model.value) {
    model.value = rounded;
    emit('change', rounded);
  }
}

function cancelInput(): void {
  isEditing.value = false;
  inputValue.value = String(model.value);
}

function onInputKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') commitInput();
  else if (event.key === 'Escape') cancelInput();
}

watch(isEditing, async (editing) => {
  if (!editing) return;
  await nextTick();
  inputRef.value?.inputElement?.select();
});

function onPointerDown(event: PointerEvent): void {
  if (event.defaultPrevented) return;
  if (d.value.disabled || d.value.readOnly || isEditing.value) return;
  pointerDownAt = Date.now();

  let isMoved = false;
  let lastValue = model.value;
  let baseX = event.clientX;
  let baseValue = model.value;
  let baseShift = event.shiftKey;

  function onMove(moveEvent: PointerEvent): void {
    if (!isMoved) {
      isMoved = true;
      document.documentElement.classList.add('cursor-ew-resize');
    }
    moveEvent.preventDefault();

    // Re-anchor when shift toggles mid-drag so the precision change isn't a jump.
    if (baseShift !== moveEvent.shiftKey) {
      baseX = moveEvent.clientX;
      baseValue = lastValue;
      baseShift = moveEvent.shiftKey;
    }

    const perPixel = moveEvent.shiftKey ? altDragStep.value : dragStep.value;
    const next = clamp(baseValue + (moveEvent.clientX - baseX) * perPixel);
    const rounded = roundToStep(next);
    if (rounded === lastValue) return;

    lastValue = rounded;
    emit('temporaryChange', rounded);
    if (displayElement.value) {
      displayElement.value.textContent = format.value(rounded);
    }
  }

  function cleanup(): void {
    document.documentElement.classList.remove('cursor-ew-resize');
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
  }

  function onUp(): void {
    cleanup();
    if (!isMoved) return;
    dragEndedAt = Date.now();
    if (lastValue !== model.value) {
      model.value = lastValue;
      emit('change', lastValue);
    }
  }

  function onCancel(): void {
    cleanup();
    if (displayElement.value) {
      displayElement.value.textContent = format.value(model.value);
    }
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onCancel);
}

function onClick(event: MouseEvent): void {
  if (event.defaultPrevented) return;
  if (d.value.disabled || d.value.readOnly) return;
  if (Date.now() - dragEndedAt < numberScrubberClickSuppressMs) return;
  enableEditing();
}

function onFocus(event: FocusEvent): void {
  if (event.defaultPrevented) return;
  if (d.value.disabled || d.value.readOnly) return;
  // Pointer-driven focus: let onClick handle it (so a drag doesn't open edit).
  if (Date.now() - pointerDownAt < numberScrubberClickSuppressMs) return;
  enableEditing();
}

const hasIcon = computed(() => Boolean(useSlots().icon));
const rootClass = computed(() =>
  cn(
    'cladd-number-scrubber',
    !d.value.disabled && !d.value.readOnly && 'cursor-ew-resize touch-pan-y',
    attrs.class,
  ),
);
const buttonContentClass = computed(() =>
  cn(
    d.value.scrubberIcon && !hasIcon.value && 'pl-1.5',
    'justify-between',
    d.value.contentClassName,
  ),
);
const editorClass = computed(() => cn('cladd-number-scrubber', attrs.class));
const editorInputClass = computed(() =>
  cn('text-left', d.value.inputClassName),
);
const iconWrapperClass = computed(() =>
  cn('shrink-0', buttonIconSizes[d.value.size], d.value.iconClassName),
);
</script>

<template>
  <Input
    v-if="isEditing"
    ref="inputRef"
    v-model="inputValue"
    auto-focus
    :class="editorClass"
    :content-class-name="d.contentClassName"
    :disabled="d.disabled"
    :icon-class-name="d.iconClassName"
    :input-class-name="editorInputClass"
    :max="d.max"
    :min="d.min"
    :rounded="d.rounded"
    :size="d.size as FieldSize"
    :step="d.step"
    type="number"
    @blur="commitInput"
    @keydown="onInputKeydown"
  >
    <template v-if="slots.icon" #icon><slot name="icon" /></template>
  </Input>
  <Button
    v-else
    v-bind="rootAttrs"
    :class="rootClass"
    :color="d.color"
    :content-class-name="buttonContentClass"
    :disabled="d.disabled"
    :outline="d.outline"
    :read-only="d.readOnly"
    :rounded="d.rounded"
    :size="d.size"
    :surface-level="d.surfaceLevel"
    :variant="d.variant"
    @click="onClick"
    @focus="onFocus"
    @pointerdown="onPointerDown"
  >
    <div v-if="slots.icon" :class="iconWrapperClass" data-part="icon">
      <slot name="icon" />
    </div>
    <DropdownIcon
      v-if="d.scrubberIcon"
      class="mr-auto shrink-0 rotate-90 text-cladd-fg-softer"
    />
    <span ref="displayElement">{{ displayed }}</span>
    <slot />
  </Button>
</template>
