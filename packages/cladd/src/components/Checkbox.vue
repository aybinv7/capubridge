<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { useUiContext } from '../contexts/uiContext.ts';
import { cn } from '../shared/cn.ts';
import {
  checkboxIndicatorSizes,
  checkboxRootSizes,
  type CheckboxProps,
} from './checkbox.contracts.ts';
import { useFieldContext, useFieldSetContext } from './fieldContext.ts';
import FocusRing from './FocusRing.vue';
import CheckIcon from './icons/CheckIcon.vue';
import Surface from './Surface.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CheckboxProps>(), {
  as: undefined,
  checkClassName: undefined,
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
const d = useComponentDefaults('Checkbox', props, {
  as: 'label' as NonNullable<CheckboxProps['as']>,
  disabled: false,
  input: true,
  required: false,
  size: 'sm' as NonNullable<CheckboxProps['size']>,
  thumbOutline: true,
});
const field = useFieldContext();
const fieldSet = useFieldSetContext();
const fieldDisabled = computed(
  () =>
    d.value.disabled ||
    (field?.disabled.value ?? false) ||
    (fieldSet?.disabled.value ?? false),
);
const fieldRequired = computed(
  () => d.value.required || (field?.required.value ?? false),
);
const fieldDescribedBy = computed(() => field?.describedBy.value);
const fieldInvalid = computed(() => field?.invalid.value ?? false);
const isReadOnly = computed(() => d.value.readOnly ?? false);
const checked = computed(() => d.value.checked ?? model.value);
const currentAccent = computed(() => d.value.color ?? ui.accentColor.value);
const hoverable = computed(() => d.value.hoverable ?? d.value.as === 'label');
const focusable = computed(
  () => d.value.focusable ?? (d.value.as === 'label' || d.value.input),
);
const inputId = computed(
  () => d.value.inputId ?? d.value.id ?? field?.controlId.value,
);

function setChecked(next: boolean, event?: Event): void {
  if (fieldDisabled.value || isReadOnly.value) return;

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
  if (d.value.input || fieldDisabled.value || isReadOnly.value) return;
  if (event.key !== ' ' && event.key !== 'Enter') return;

  event.preventDefault();
  setChecked(!checked.value);
}

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

const rootClass = computed(() =>
  cn(
    'cladd-checkbox group/cladd-checkbox relative flex shrink-0 items-center justify-center rounded-full select-none',
    checkboxRootSizes[d.value.size],
    fieldDisabled.value && 'opacity-50',
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
    'cladd-checkbox__indicator pointer-events-none relative duration-200',
    checkboxIndicatorSizes[d.value.size],
    !checked.value && 'scale-75 text-cladd-fg-soft',
    checked.value &&
      !fieldDisabled.value &&
      !isReadOnly.value &&
      'group-active/cladd-checkbox:scale-90',
    !checked.value &&
      !fieldDisabled.value &&
      !isReadOnly.value &&
      'group-active/cladd-checkbox:scale-65',
    checked.value && 'text-cladd-on-primary',
    checked.value && `cladd-color-${currentAccent.value}`,
    d.value.checkClassName,
  ),
);
</script>

<template>
  <component
    :is="d.as"
    v-bind="rootAttrs"
    :class="rootClass"
    :aria-checked="!d.input ? checked : undefined"
    :aria-disabled="!d.input && fieldDisabled ? 'true' : undefined"
    :aria-readonly="!d.input && isReadOnly ? 'true' : undefined"
    :aria-required="!d.input && fieldRequired ? 'true' : undefined"
    :data-checked="checked || undefined"
    :data-disabled="fieldDisabled || undefined"
    :data-readonly="isReadOnly || undefined"
    :data-required="fieldRequired || undefined"
    :data-state="checked ? 'checked' : 'unchecked'"
    :data-unchecked="!checked || undefined"
    :role="!d.input ? 'checkbox' : undefined"
    :tabindex="!d.input ? (fieldDisabled ? -1 : 0) : undefined"
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
      :disabled="fieldDisabled || isReadOnly"
      :name="d.name"
      :readonly="isReadOnly"
      :required="fieldRequired"
      type="checkbox"
      :value="d.value"
      @change="handleInputChange"
    />
    <Surface
      as="span"
      :class="thumbClass"
      data-part="thumb"
      :clickable="hoverable && !fieldDisabled && !isReadOnly"
      :hoverable="hoverable && !fieldDisabled && !isReadOnly"
      :outline="d.thumbOutline"
      variant="gradient"
      :wrap-content="false"
    />
    <Surface
      as="span"
      :color="currentAccent"
      :class="checkedThumbClass"
      data-part="thumb-checked"
      :clickable="hoverable && !fieldDisabled && !isReadOnly"
      :hoverable="hoverable && !fieldDisabled && !isReadOnly"
      :outline="d.thumbOutline"
      variant="gradient-fill"
      :wrap-content="false"
    />
    <CheckIcon
      :class="indicatorClass"
      data-part="indicator"
      :data-state="checked ? 'checked' : 'unchecked'"
    />
    <FocusRing
      v-if="focusable && !fieldDisabled && !isReadOnly"
      class="rounded-full"
      group="checkbox"
    />
  </component>
</template>
