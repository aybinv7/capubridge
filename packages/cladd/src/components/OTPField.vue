<script setup lang="ts">
import { computed, h, useAttrs, useSlots } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import { roundedClasses } from '../shared/roundedClasses.ts';
import FocusRing from './FocusRing.vue';
import type { FieldSize } from './form.contracts.ts';
import type { OTPFieldProps } from './otpField.contracts.ts';
import {
  provideOTPFieldContext,
  type OTPInputMode,
} from './otpFieldContext.ts';
import OTPFieldInput from './OTPFieldInput.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<OTPFieldProps>(), {
  disabled: undefined,
  inputMode: undefined,
  maxLength: undefined,
  pattern: undefined,
  readOnly: undefined,
  size: undefined,
  tightFocusRing: undefined,
  valid: undefined,
});

/** Controlled value. The character at index `i` populates cell `i`. */
const model = defineModel<string>({ default: '' });

const d = useComponentDefaults('OTPField', props, {
  disabled: false,
  inputMode: 'numeric' as OTPInputMode,
  pattern: '[0-9]',
  readOnly: false,
  size: 'lg' as FieldSize,
  tightFocusRing: false,
  valid: true,
});

defineSlots<{
  /** OTP cells - one or more `OTPFieldInput`, with optional `OTPFieldSeparator` between. */
  default?: () => unknown;
}>();

const slots = useSlots();
const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

const inputs: (HTMLInputElement | undefined)[] = [];
let claimed = 0;

const totalCells = computed(() => d.value.maxLength ?? claimed);

const charRegex = computed(() => {
  try {
    return new RegExp(`^(?:${d.value.pattern})$`, 'u');
  } catch {
    return null;
  }
});

function isAllowed(char: string): boolean {
  const regex = charRegex.value;
  return regex ? regex.test(char) : true;
}

function focusCell(index: number): void {
  const element = inputs[index];
  if (!element) return;
  if (document.activeElement !== element) element.focus();
  // Select existing content so the next typed character overwrites it.
  element.setSelectionRange(0, element.value.length);
}

function setCharAt(source: string, index: number, char: string): string {
  const total = totalCells.value;
  if (char === '') {
    if (index >= source.length) return source;
    return source.slice(0, index) + source.slice(index + 1);
  }
  if (index > source.length) return source;
  if (index === source.length) return (source + char).slice(0, total);
  return (source.slice(0, index) + char + source.slice(index + 1)).slice(
    0,
    total,
  );
}

provideOTPFieldContext({
  claimIndex: () => claimed++,
  disabled: computed(() => d.value.disabled),
  getCellValue: (index) => model.value[index] ?? '',
  inputMode: computed(() => d.value.inputMode),
  onCellChange(index, raw) {
    const current = model.value;
    if (raw === '') {
      const next = setCharAt(current, index, '');
      if (next !== current) model.value = next;
      return;
    }

    const char = raw.slice(-1);
    if (!isAllowed(char)) return;

    const next = setCharAt(current, index, char);
    if (next !== current) model.value = next;
    if (index < totalCells.value - 1) focusCell(index + 1);
  },
  onCellFocus(_index, event) {
    const element = event.currentTarget as HTMLInputElement;
    // Select existing content so the next typed char overwrites it.
    if (element.value.length === 0) return;
    element.setSelectionRange(0, element.value.length);
  },
  onCellKeyDown(index, event) {
    const current = model.value;

    if (event.key === 'Backspace') {
      if (current[index]) {
        event.preventDefault();
        model.value = setCharAt(current, index, '');
        return;
      }
      if (index > 0) {
        event.preventDefault();
        model.value = setCharAt(current, index - 1, '');
        focusCell(index - 1);
      }
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusCell(index - 1);
      return;
    }

    if (event.key === 'ArrowRight' && index < totalCells.value - 1) {
      event.preventDefault();
      focusCell(index + 1);
    }
  },
  onCellPaste(index, event) {
    const text = event.clipboardData?.getData('text');
    if (!text) return;
    event.preventDefault();

    const filtered = [...text].filter(isAllowed).join('');
    if (!filtered) return;

    const current = model.value;
    const total = totalCells.value;
    let next = current.slice(0, Math.min(index, current.length));
    for (const char of filtered) {
      if (next.length >= total) break;
      next += char;
    }

    if (next !== current) model.value = next;
    focusCell(Math.min(next.length, total - 1));
  },
  pattern: computed(() => d.value.pattern),
  readOnly: computed(() => d.value.readOnly),
  registerInput: (index, element) => (inputs[index] = element),
  size: computed(() => d.value.size),
  valid: computed(() => d.value.valid),
});

const radii = computed(() => roundedClasses(d.value.size));
const showInvalidRing = computed(
  () => !d.value.readOnly && !d.value.disabled && !d.value.valid,
);
const rootClass = computed(() =>
  cn('cladd-otp-field relative flex items-center gap-1', attrs.class),
);

/** Upstream generates cells when no children are supplied; `maxLength` is then required. */
const generatedCells = computed(() =>
  slots.default
    ? undefined
    : Array.from({ length: d.value.maxLength ?? 0 }, (_unused, index) =>
        h(OTPFieldInput, { key: index }),
      ),
);
</script>

<template>
  <div
    v-bind="rootAttrs"
    :class="rootClass"
    :data-disabled="d.disabled || undefined"
    :data-invalid="d.valid === false || undefined"
    :data-readonly="d.readOnly || undefined"
  >
    <FocusRing
      v-if="showInvalidRing"
      :class="
        d.tightFocusRing ? radii.itemRoundedClasses : radii.focusRoundedClasses
      "
      color="red"
      force
      :offset="!d.tightFocusRing"
    />
    <slot />
    <component :is="cell" v-for="(cell, i) in generatedCells" :key="i" />
  </div>
</template>
