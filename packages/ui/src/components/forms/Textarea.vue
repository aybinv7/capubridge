<script setup lang="ts">
import { computed, ref, useAttrs, watch } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import { cn } from "../../shared/cn.ts";
import { roundedClasses } from "../../shared/roundedClasses.ts";
import { rootSizeClasses } from "../../shared/sizeClasses.ts";
import FocusRing from "../feedback/FocusRing.vue";
import SurfaceCut from "../surface/SurfaceCut.vue";
import {
  textareaFontSizes,
  textareaIconWrapClasses,
  textareaPaddingNoIcon,
  textareaPaddingVertical,
  textareaPaddingWithIcon,
  type TextareaProps,
} from "./textarea.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TextareaProps>(), {
  accent: undefined,
  as: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  errorMessage: undefined,
  iconClassName: undefined,
  infoMessage: undefined,
  inputClassName: undefined,
  maxLength: undefined,
  placeholder: undefined,
  placeholderClassName: undefined,
  readOnly: undefined,
  rounded: undefined,
  size: undefined,
  tightFocusRing: undefined,
  updateContentOnChange: undefined,
  valid: undefined,
});

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
const d = useComponentDefaults("Textarea", props, {
  as: "div" as TextareaProps["as"],
  disabled: false,
  readOnly: false,
  rounded: false,
  size: "lg" as TextareaProps["size"],
  tightFocusRing: false,
  updateContentOnChange: true,
  valid: true,
});
const currentAccent = computed(() => d.value.color ?? d.value.accent ?? ui.accentColor.value);
const controlElement = ref<HTMLElement>();
const text = ref<string>();
const editable = computed(() => !d.value.disabled && !d.value.readOnly);

const radii = computed(() => roundedClasses(d.value.size, d.value.rounded, true));
const heightClass = computed(() => rootSizeClasses(d.value.size, "min-height"));
const inputPadding = computed(() =>
  cn(
    textareaPaddingVertical[d.value.size],
    slots.icon ? textareaPaddingWithIcon[d.value.size] : textareaPaddingNoIcon[d.value.size],
  ),
);

const rootClass = computed(() =>
  cn(
    "cui-textarea group/cui-textarea relative",
    d.value.disabled && "opacity-50",
    radii.value.itemRoundedClasses,
  ),
);

const focusRingClass = computed(() =>
  d.value.tightFocusRing ? "rounded-[inherit]" : radii.value.focusRoundedClasses,
);

const iconClass = computed(() =>
  cn("pointer-events-none absolute", textareaIconWrapClasses[d.value.size], d.value.iconClassName),
);

const controlClass = computed(() =>
  cn(
    inputPadding.value,
    heightClass.value,
    radii.value.itemRoundedClasses,
    textareaFontSizes[d.value.size],
    "w-full appearance-none border-none bg-transparent font-medium whitespace-pre-wrap shadow-none outline-none",
    d.value.disabled && "text-cui-fg-softer",
    d.value.inputClassName,
  ),
);

const placeholderClass = computed(() =>
  cn(
    "pointer-events-none absolute top-0 left-0 h-full w-full text-cui-fg-softer select-none",
    textareaFontSizes[d.value.size],
    inputPadding.value,
    d.value.placeholderClassName,
  ),
);

const infoClass = computed(() =>
  cn(
    `cui-color-${currentAccent.value}`,
    "pointer-events-none absolute -top-1.5 left-2 z-10 translate-y-1 rounded-cui-sm bg-cui-primary px-2 py-1.5 text-cui-2xs leading-none font-semibold text-cui-on-primary opacity-0 duration-200 group-has-[[contenteditable]:focus]/cui-textarea:-translate-y-1/2 group-has-[[contenteditable]:focus]/cui-textarea:opacity-100",
  ),
);

const errorClass =
  "cui-color-red pointer-events-none absolute -top-1.5 left-2 z-10 -translate-y-1/2 rounded-cui-sm bg-cui-primary px-1 py-0.5 text-cui-2xs leading-none font-semibold text-cui-on-primary opacity-100 duration-200";

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

  if (d.value.maxLength !== undefined && next.length > d.value.maxLength) {
    next = next.slice(0, d.value.maxLength);
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
    if (d.value.updateContentOnChange && element) {
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
    :accent="d.accent"
    :as="d.as"
    :class="rootClass"
    :color="d.color"
    :data-disabled="d.disabled || undefined"
    :data-invalid="!d.valid || undefined"
    :data-readonly="d.readOnly || undefined"
    :hoverable="editable"
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
          :class="controlClass"
          :contenteditable="editable"
          data-part="control"
          @blur="emit('blur', $event)"
          @focus="emit('focus', $event)"
          @input="onInput"
          @keydown="emit('keydown', $event)"
          @paste="onPaste"
        />
        <div v-if="!text && d.placeholder" :class="placeholderClass" data-part="placeholder">
          {{ d.placeholder }}
        </div>
      </div>

      <slot name="suffix" />
    </div>

    <div v-if="d.infoMessage && d.valid && !d.readOnly" :class="infoClass" data-part="info">
      {{ d.infoMessage }}
    </div>
    <div v-if="d.errorMessage && !d.valid" :class="errorClass" data-part="error">
      {{ d.errorMessage }}
    </div>
  </SurfaceCut>
</template>
