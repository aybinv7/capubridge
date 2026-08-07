<script setup lang="ts">
import { computed, ref, useAttrs, watch, type Component } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import { roundedClasses } from "../../shared/roundedClasses.ts";
import { rootSizeClasses } from "../../shared/sizeClasses.ts";
import FocusRing from "../feedback/FocusRing.vue";
import SurfaceCut from "../surface/SurfaceCut.vue";
import type { FieldSize } from "./form.contracts.ts";
import {
  textareaFontSizes,
  textareaIconWrapClasses,
  textareaPaddingNoIcon,
  textareaPaddingVertical,
  textareaPaddingWithIcon,
} from "./textarea.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    as?: string | Component;
    color?: UiAccent;
    contentClassName?: string;
    disabled?: boolean;
    errorMessage?: string;
    iconClassName?: string;
    infoMessage?: string;
    inputClassName?: string;
    maxLength?: number;
    placeholder?: string;
    placeholderClassName?: string;
    readOnly?: boolean;
    rounded?: boolean;
    size?: FieldSize;
    tightFocusRing?: boolean;
    updateContentOnChange?: boolean;
    valid?: boolean;
  }>(),
  {
    accent: undefined,
    as: "div",
    color: undefined,
    contentClassName: undefined,
    disabled: false,
    errorMessage: undefined,
    iconClassName: undefined,
    infoMessage: undefined,
    inputClassName: undefined,
    maxLength: undefined,
    placeholder: undefined,
    placeholderClassName: undefined,
    readOnly: false,
    rounded: false,
    size: "lg",
    tightFocusRing: false,
    updateContentOnChange: true,
    valid: true,
  },
);

const slots = defineSlots<{
  icon?: () => unknown;
  prefix?: () => unknown;
  suffix?: () => unknown;
}>();

const emit = defineEmits<{
  blur: [event: FocusEvent];
  change: [value: string, event: Event];
  focus: [event: FocusEvent];
  keydown: [event: KeyboardEvent];
}>();

const model = defineModel<string>({ default: "" });
const ui = useUiContext();
const attrs = useAttrs();
const currentAccent = computed(() => props.color ?? props.accent ?? ui.accent.value);
const controlElement = ref<HTMLElement>();
const text = ref<string>();
const editable = computed(() => !props.disabled && !props.readOnly);

const radii = computed(() => roundedClasses(props.size, props.rounded, true));
const heightClass = computed(() => rootSizeClasses(props.size, "min-height"));
const inputPadding = computed(() =>
  cn(
    textareaPaddingVertical[props.size],
    slots.icon ? textareaPaddingWithIcon[props.size] : textareaPaddingNoIcon[props.size],
  ),
);

const rootClass = computed(() =>
  cn(
    "cui-textarea group/cui-textarea relative",
    props.disabled && "opacity-50",
    radii.value.itemRoundedClasses,
  ),
);

const focusRingClass = computed(() =>
  props.tightFocusRing ? "rounded-[inherit]" : radii.value.focusRoundedClasses,
);

const iconClass = computed(() =>
  cn("pointer-events-none absolute", textareaIconWrapClasses[props.size], props.iconClassName),
);

const controlClass = computed(() =>
  cn(
    inputPadding.value,
    heightClass.value,
    radii.value.itemRoundedClasses,
    textareaFontSizes[props.size],
    "w-full appearance-none border-none bg-transparent font-medium whitespace-pre-wrap shadow-none outline-none",
    props.disabled && "text-cui-fg-softer",
    props.inputClassName,
  ),
);

const placeholderClass = computed(() =>
  cn(
    "pointer-events-none absolute top-0 left-0 h-full w-full text-cui-fg-softer select-none",
    textareaFontSizes[props.size],
    inputPadding.value,
    props.placeholderClassName,
  ),
);

const infoClass = computed(() =>
  cn(
    `cui-accent-${currentAccent.value}`,
    "pointer-events-none absolute -top-1.5 left-2 z-10 translate-y-1 rounded-cui-sm bg-cui-primary px-2 py-1.5 text-cui-2xs leading-none font-semibold text-cui-on-primary opacity-0 duration-200 group-has-[[contenteditable]:focus]/cui-textarea:-translate-y-1/2 group-has-[[contenteditable]:focus]/cui-textarea:opacity-100",
  ),
);

const errorClass =
  "cui-accent-red pointer-events-none absolute -top-1.5 left-2 z-10 -translate-y-1/2 rounded-cui-sm bg-cui-primary px-1 py-0.5 text-cui-2xs leading-none font-semibold text-cui-on-primary opacity-100 duration-200";

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
  const plain = event.clipboardData?.getData("text/plain");
  if (plain === undefined) return;
  event.preventDefault();
  document.execCommand("insertText", false, plain);
}

function onInput(event: Event): void {
  const target = event.target as HTMLElement;
  let next = target.innerText;
  if (next === "\n") next = "";

  if (props.maxLength !== undefined && next.length > props.maxLength) {
    next = next.slice(0, props.maxLength);
    target.innerText = next;
    moveCaretToEnd(target);
  }

  text.value = next;
  model.value = next;
  emit("change", next, event);
}

watch(
  [model, controlElement],
  ([value, element]) => {
    if (text.value === value) return;
    text.value = value;
    if (props.updateContentOnChange && element) {
      element.innerText = value ?? "";
    }
  },
  { flush: "post", immediate: true },
);

defineExpose({ focus: () => controlElement.value?.focus() });
</script>

<template>
  <SurfaceCut
    v-bind="attrs"
    :accent="props.accent"
    :as="props.as"
    :class="rootClass"
    :color="props.color"
    :data-disabled="props.disabled || undefined"
    :data-invalid="!props.valid || undefined"
    :data-readonly="props.readOnly || undefined"
    :hoverable="editable"
    :wrap-content="false"
  >
    <FocusRing
      v-if="editable"
      :class="focusRingClass"
      :color="props.valid ? currentAccent : 'red'"
      :force="!props.valid"
      group="textarea"
      :offset="!props.tightFocusRing"
    />

    <div
      :class="cn('relative flex items-center', props.contentClassName)"
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
          :class="controlClass"
          :contenteditable="editable"
          data-part="control"
          @blur="emit('blur', $event)"
          @focus="emit('focus', $event)"
          @input="onInput"
          @keydown="emit('keydown', $event)"
          @paste="onPaste"
        />
        <div v-if="!text && props.placeholder" :class="placeholderClass" data-part="placeholder">
          {{ props.placeholder }}
        </div>
      </div>

      <slot name="suffix" />
    </div>

    <div
      v-if="props.infoMessage && props.valid && !props.readOnly"
      :class="infoClass"
      data-part="info"
    >
      {{ props.infoMessage }}
    </div>
    <div v-if="props.errorMessage && !props.valid" :class="errorClass" data-part="error">
      {{ props.errorMessage }}
    </div>
  </SurfaceCut>
</template>
