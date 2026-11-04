<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { useUiContext } from '../contexts/uiContext.ts';
import { cn } from '../shared/cn.ts';
import { useFieldContext, useFieldSetContext } from './fieldContext.ts';
import FocusRing from './FocusRing.vue';
import {
  radioIndicatorSizes,
  radioRootSizes,
  type RadioProps,
} from './radio.contracts.ts';
import Surface from './Surface.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<RadioProps>(), {
  as: undefined,
  checked: undefined,
  color: undefined,
  disabled: undefined,
  focusable: undefined,
  hoverable: undefined,
  id: undefined,
  input: undefined,
  inputId: undefined,
  name: undefined,
  readOnly: undefined,
  required: undefined,
  size: undefined,
  thumbOutline: undefined,
  value: undefined,
});

const model = defineModel<boolean>({ default: false });
const emit = defineEmits<{
  change: [checked: boolean, event?: Event];
  'update:checked': [checked: boolean];
}>();
const ui = useUiContext();
const d = useComponentDefaults('Radio', props, {
  as: 'label' as NonNullable<RadioProps['as']>,
  disabled: false,
  input: true,
  required: false,
  size: 'sm' as NonNullable<RadioProps['size']>,
  thumbOutline: true,
});
const field = useFieldContext();
const fieldSet = useFieldSetContext();
const fieldDescribedBy = computed(() => field?.describedBy.value);
const fieldInvalid = computed(() => field?.invalid.value ?? false);
const isReadOnly = computed(() => d.value.readOnly ?? false);
const checked = computed(() => d.value.checked ?? model.value);
const disabled = computed(
  () =>
    d.value.disabled ||
    (field?.disabled.value ?? false) ||
    (fieldSet?.disabled.value ?? false),
);
const name = computed(() => d.value.name);
const required = computed(
  () => d.value.required || (field?.required.value ?? false),
);
const currentAccent = computed(() => d.value.color ?? ui.accentColor.value);
const hoverable = computed(() => d.value.hoverable ?? d.value.as === 'label');
const focusable = computed(
  () => d.value.focusable ?? (d.value.as === 'label' || d.value.input),
);
const inputId = computed(
  () => d.value.inputId ?? d.value.id ?? field?.controlId.value,
);

function setChecked(next: boolean, event?: Event): void {
  if (disabled.value || isReadOnly.value) return;

  model.value = next;
  emit('update:checked', next);
  emit('change', next, event);
}

function handleInputChange(event: Event): void {
  setChecked((event.target as HTMLInputElement).checked, event);
}

function handleRootClick(event: MouseEvent): void {
  if (!d.value.input) {
    setChecked(!checked.value, event);
    return;
  }

  if (event.target instanceof HTMLInputElement) return;

  event.preventDefault();
  setChecked(!checked.value, event);
}

function handleFallbackKeydown(event: KeyboardEvent): void {
  if (d.value.input || disabled.value || isReadOnly.value) return;
  if (event.key !== ' ' && event.key !== 'Enter') return;

  event.preventDefault();
  setChecked(!checked.value, event);
}

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

const rootClass = computed(() =>
  cn(
    'cladd-radio group/cladd-radio relative flex shrink-0 items-center justify-center rounded-full select-none',
    radioRootSizes[d.value.size],
    disabled.value && 'opacity-50',
    attrs.class,
  ),
);

const thumbClass =
  'absolute inset-0 size-full shrink-0 rounded-full duration-200';

const checkedThumbClass = computed(() =>
  cn(
    thumbClass,
    !checked.value && 'scale-0',
    checked.value ? 'opacity-100' : 'opacity-0',
  ),
);

const indicatorClass = computed(() =>
  cn(
    'cladd-radio__indicator pointer-events-none relative rounded-full duration-200',
    radioIndicatorSizes[d.value.size],
    !checked.value && 'scale-75 bg-cladd-fg-soft',
    !checked.value &&
      !isReadOnly.value &&
      !disabled.value &&
      'group-active/cladd-radio:scale-65',
    checked.value && `cladd-color-${currentAccent.value}`,
    checked.value && 'bg-cladd-on-primary',
    checked.value &&
      !disabled.value &&
      !isReadOnly.value &&
      'group-active/cladd-radio:scale-90',
  ),
);
</script>

<template>
  <component
    :is="d.as"
    v-bind="rootAttrs"
    :class="rootClass"
    :aria-checked="!d.input ? checked : undefined"
    :aria-disabled="!d.input && disabled ? 'true' : undefined"
    :aria-readonly="!d.input && isReadOnly ? 'true' : undefined"
    :aria-required="!d.input && required ? 'true' : undefined"
    :data-checked="checked || undefined"
    :data-disabled="disabled || undefined"
    :data-readonly="isReadOnly || undefined"
    :data-required="required || undefined"
    :data-state="checked ? 'checked' : 'unchecked'"
    :data-unchecked="!checked || undefined"
    :role="!d.input ? 'radio' : undefined"
    :tabindex="!d.input ? (disabled ? -1 : 0) : undefined"
    @click="handleRootClick"
    @contextmenu.capture.prevent
    @keydown="handleFallbackKeydown"
  >
    <input
      v-if="d.input"
      :id="inputId"
      class="pointer-events-none absolute inset-1 z-10 opacity-0"
      data-part="input"
      :aria-describedby="fieldDescribedBy"
      :aria-invalid="fieldInvalid || undefined"
      :checked="checked"
      :disabled="disabled || isReadOnly"
      :name="name"
      :readonly="isReadOnly"
      :required="required"
      type="checkbox"
      :value="d.value"
      @change="handleInputChange"
    />
    <Surface
      as="span"
      :class="thumbClass"
      :clickable="hoverable && !disabled && !isReadOnly"
      data-part="thumb"
      :hoverable="hoverable && !disabled && !isReadOnly"
      :outline="d.thumbOutline"
      variant="gradient"
      :wrap-content="false"
    />
    <Surface
      as="span"
      :class="checkedThumbClass"
      :clickable="hoverable && !disabled && !isReadOnly"
      :color="currentAccent"
      data-part="thumb-checked"
      :hoverable="hoverable && !disabled && !isReadOnly"
      :outline="d.thumbOutline"
      variant="gradient-fill"
      :wrap-content="false"
    />
    <span :class="indicatorClass" data-part="indicator" />
    <FocusRing
      v-if="focusable && !disabled && !isReadOnly"
      class="rounded-full"
      group="radio"
    />
  </component>
</template>
