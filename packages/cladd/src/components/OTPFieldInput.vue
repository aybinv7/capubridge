<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useAttrs, watch } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import { rootSizeClasses } from '../shared/sizeClasses.ts';
import Input from './Input.vue';
import type { OTPFieldInputProps } from './otpField.contracts.ts';
import { useOTPFieldContext } from './otpFieldContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<OTPFieldInputProps>(), {
  inputClassName: undefined,
  placeholder: undefined,
});

const d = useComponentDefaults('OTPFieldInput', props, {});
const field = useOTPFieldContext();
// Claimed once at mount, in template order. Upstream recomputes every cell's
// index from the live `children` array on every render, which self-corrects
// if a consumer conditionally adds, removes or reorders cells at runtime.
// This claims a fixed slot instead, which only desyncs under that same
// runtime-reordering case - not a realistic use of a fixed-length OTP field,
// so it isn't worth the reactive child-tracking upstream's approach needs.
const index = field?.claimIndex() ?? 0;

const attrs = useAttrs();
const inputRef = ref<{ inputElement?: HTMLInputElement }>();

watch(
  () => inputRef.value?.inputElement,
  (element) => field?.registerInput(index, element),
  { immediate: true },
);

onBeforeUnmount(() => field?.registerInput(index, undefined));

const size = computed(() => field?.size.value ?? 'lg');
const cellValue = computed(() => field?.getCellValue(index) ?? '');

const rootClass = computed(() =>
  cn(
    'cladd-otp-field-input',
    rootSizeClasses(size.value, 'width'),
    attrs.class,
  ),
);
const controlClass = computed(() =>
  cn('px-0 text-center', d.value.inputClassName),
);

function onChange(value: string): void {
  field?.onCellChange(index, value);
}
</script>

<template>
  <Input
    ref="inputRef"
    :class="rootClass"
    :disabled="field?.disabled.value"
    :input-class-name="controlClass"
    :input-mode="field?.inputMode.value"
    :input-props="{
      autocomplete: index === 0 ? 'one-time-code' : 'off',
      onPaste: (event: ClipboardEvent) => field?.onCellPaste(index, event),
    }"
    :max-length="1"
    :model-value="cellValue"
    :pattern="field?.pattern.value"
    :placeholder="d.placeholder"
    :read-only="field?.readOnly.value"
    :size="size"
    @focus="(event: FocusEvent) => field?.onCellFocus(index, event)"
    @keydown="(event: KeyboardEvent) => field?.onCellKeyDown(index, event)"
    @update:model-value="onChange"
  />
</template>
