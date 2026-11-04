<script setup lang="ts">
import { computed, ref, useAttrs, watch } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { useUiContext } from '../contexts/uiContext.ts';
import { cn } from '../shared/cn.ts';
import { roundedClasses } from '../shared/roundedClasses.ts';
import { rootSizeClasses } from '../shared/sizeClasses.ts';
import { useFieldContext, useFieldSetContext } from './fieldContext.ts';
import FocusRing from './FocusRing.vue';
import SurfaceCut from './SurfaceCut.vue';
import {
  textareaFontSizes,
  textareaIconWrapClasses,
  textareaPaddingNoIcon,
  textareaPaddingVertical,
  textareaPaddingWithIcon,
  type TextareaProps,
} from './textarea.contracts.ts';
import VNodeRenderer from './VNodeRenderer.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TextareaProps>(), {
  as: undefined,
  bgClassName: undefined,
  clickable: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  errorMessage: undefined,
  iconClassName: undefined,
  infoMessage: undefined,
  inputClassName: undefined,
  inputPadding: undefined,
  maxLength: undefined,
  placeholder: undefined,
  placeholderClassName: undefined,
  outline: undefined,
  overlayClassName: undefined,
  overlayPosition: undefined,
  pressed: undefined,
  readOnly: undefined,
  rounded: undefined,
  size: undefined,
  tightFocusRing: undefined,
  updateContentOnChange: undefined,
  valid: undefined,
  wrapContent: undefined,
});

const slots = defineSlots<{
  error?: () => unknown;
  icon?: () => unknown;
  info?: () => unknown;
  prefix?: () => unknown;
  suffix?: () => unknown;
}>();

const emit = defineEmits<{
  blur: [event: FocusEvent];
  change: [value: string, event: Event];
  focus: [event: FocusEvent];
  keydown: [event: KeyboardEvent];
}>();

const model = defineModel<string>({ default: '' });
const ui = useUiContext();
const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const d = useComponentDefaults('Textarea', props, {
  as: 'div' as NonNullable<TextareaProps['as']>,
  disabled: false,
  readOnly: false,
  rounded: false,
  size: 'lg' as NonNullable<TextareaProps['size']>,
  tightFocusRing: false,
  updateContentOnChange: true,
  valid: true,
});
const currentAccent = computed(() => d.value.color ?? ui.accentColor.value);
const field = useFieldContext();
const fieldSet = useFieldSetContext();
const fieldControlId = computed(() => field?.controlId.value);
const fieldDescribedBy = computed(() => field?.describedBy.value);
const fieldInvalid = computed(
  () => !d.value.valid || (field?.invalid.value ?? false),
);
const fieldDisabled = computed(
  () =>
    d.value.disabled ||
    (field?.disabled.value ?? false) ||
    (fieldSet?.disabled.value ?? false),
);
const controlElement = ref<HTMLElement>();
const text = ref<string>();
const editable = computed(() => !fieldDisabled.value && !d.value.readOnly);

const radii = computed(() =>
  roundedClasses(d.value.size, d.value.rounded, true),
);
const heightClass = computed(() => rootSizeClasses(d.value.size, 'min-height'));
const inputPadding = computed(() =>
  cn(
    textareaPaddingVertical[d.value.size],
    slots.icon
      ? textareaPaddingWithIcon[d.value.size]
      : textareaPaddingNoIcon[d.value.size],
  ),
);

const rootClass = computed(() =>
  cn(
    'cladd-textarea group/cladd-textarea relative',
    d.value.disabled && 'opacity-50',
    radii.value.itemRoundedClasses,
    attrs.class,
  ),
);

const focusRingClass = computed(() =>
  d.value.tightFocusRing
    ? 'rounded-[inherit]'
    : radii.value.focusRoundedClasses,
);

const iconClass = computed(() =>
  cn(
    'pointer-events-none absolute',
    textareaIconWrapClasses[d.value.size],
    d.value.iconClassName,
  ),
);

const controlClass = computed(() =>
  cn(
    inputPadding.value,
    heightClass.value,
    radii.value.itemRoundedClasses,
    textareaFontSizes[d.value.size],
    'w-full appearance-none border-none bg-transparent font-medium whitespace-pre-wrap shadow-none outline-none',
    d.value.disabled && 'text-cladd-fg-softer',
    d.value.inputClassName,
  ),
);

const placeholderClass = computed(() =>
  cn(
    'pointer-events-none absolute top-0 left-0 h-full w-full text-cladd-fg-softer select-none',
    textareaFontSizes[d.value.size],
    inputPadding.value,
    d.value.placeholderClassName,
  ),
);

const infoClass = computed(() =>
  cn(
    `cladd-color-${currentAccent.value}`,
    'pointer-events-none absolute -top-1.5 left-2 z-10 translate-y-1 rounded-cladd-sm bg-cladd-primary px-2 py-1.5 text-cladd-2xs leading-none font-semibold text-cladd-on-primary opacity-0 duration-200 group-has-[[contenteditable]:focus]/cladd-textarea:-translate-y-1/2 group-has-[[contenteditable]:focus]/cladd-textarea:opacity-100',
  ),
);

const errorClass =
  'cladd-color-red pointer-events-none absolute -top-1.5 left-2 z-10 -translate-y-1/2 rounded-cladd-sm bg-cladd-primary px-1 py-0.5 text-cladd-2xs leading-none font-semibold text-cladd-on-primary opacity-100 duration-200';

function moveCaretToEnd(element: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function onPaste(event: ClipboardEvent): void {
  const plain = event.clipboardData?.getData('text/plain');
  if (plain === undefined) return;
  event.preventDefault();
  document.execCommand('insertText', false, plain);
}

function onInput(event: Event): void {
  const target = event.target as HTMLElement;
  let next = target.innerText;
  if (next === '\n') next = '';

  if (d.value.maxLength !== undefined && next.length > d.value.maxLength) {
    next = next.slice(0, d.value.maxLength);
    target.innerText = next;
    moveCaretToEnd(target);
  }

  text.value = next;
  model.value = next;
  emit('change', next, event);
}

watch(
  [model, controlElement],
  ([value, element]) => {
    if (text.value === value) return;
    text.value = value;
    if (d.value.updateContentOnChange && element) {
      element.innerText = value ?? '';
    }
  },
  { flush: 'post', immediate: true },
);

defineExpose({ focus: () => controlElement.value?.focus() });
</script>

<template>
  <SurfaceCut
    v-bind="rootAttrs"
    :as="d.as"
    :bg-class-name="d.bgClassName"
    :class="rootClass"
    :clickable="d.clickable"
    :color="d.color"
    :data-disabled="fieldDisabled || undefined"
    :data-invalid="fieldInvalid || undefined"
    :data-readonly="d.readOnly || undefined"
    :hoverable="editable"
    :outline="d.outline"
    :overlay-class-name="d.overlayClassName"
    :overlay-position="d.overlayPosition"
    :pressed="d.pressed"
    :wrap-content="false"
  >
    <FocusRing
      v-if="editable"
      :class="focusRingClass"
      :color="d.valid ? currentAccent : 'red'"
      :force="!d.valid"
      group="textarea"
      :offset="!d.tightFocusRing"
    />

    <div
      :class="cn('relative flex items-center', d.contentClassName)"
      data-part="wrapper"
      @contextmenu.capture.prevent
    >
      <slot name="prefix" />
      <div v-if="$slots.icon" :class="iconClass" data-part="icon">
        <slot name="icon" />
      </div>
      <div class="relative flex w-full">
        <div
          ref="controlElement"
          :id="fieldControlId"
          :aria-describedby="fieldDescribedBy"
          :aria-invalid="fieldInvalid || undefined"
          :class="controlClass"
          :contenteditable="editable ? 'plaintext-only' : 'false'"
          data-part="control"
          @blur="emit('blur', $event)"
          @focus="emit('focus', $event)"
          @input="onInput"
          @keydown="emit('keydown', $event)"
          @paste="onPaste"
        />
        <div
          v-if="!text && d.placeholder"
          :class="placeholderClass"
          data-part="placeholder"
        >
          {{ d.placeholder }}
        </div>
      </div>

      <slot name="suffix" />
    </div>

    <div
      v-if="(d.infoMessage || $slots.info) && d.valid && !d.readOnly"
      :class="infoClass"
      data-part="info"
    >
      <slot name="info"><VNodeRenderer :node="d.infoMessage" /></slot>
    </div>
    <div
      v-if="(d.errorMessage || $slots.error) && !d.valid"
      :class="errorClass"
      data-part="error"
    >
      <slot name="error"><VNodeRenderer :node="d.errorMessage" /></slot>
    </div>
  </SurfaceCut>
</template>
