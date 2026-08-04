<script setup lang="ts">
import { computed, ref, useAttrs, useId, watch, type Component } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
import FocusRing from "../feedback/FocusRing.vue";
import SurfaceCut from "../surface/SurfaceCut.vue";
import FieldMessage from "./FieldMessage.vue";
import type { FieldSize } from "./form.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    as?: string | Component;
    color?: UiAccent;
    contentClassName?: string;
    disabled?: boolean;
    errorMessage?: string;
    icon?: unknown;
    iconClassName?: string;
    id?: string;
    infoMessage?: string;
    inputClassName?: string;
    maxlength?: number;
    placeholder?: string;
    placeholderClassName?: string;
    readonly?: boolean;
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
    icon: undefined,
    iconClassName: undefined,
    id: undefined,
    infoMessage: undefined,
    inputClassName: undefined,
    maxlength: undefined,
    placeholder: undefined,
    placeholderClassName: undefined,
    readonly: false,
    rounded: false,
    size: "lg",
    tightFocusRing: false,
    updateContentOnChange: true,
    valid: true,
  },
);

defineSlots<{
  icon?: () => unknown;
  prefix?: () => unknown;
  suffix?: () => unknown;
}>();

const emit = defineEmits<{
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
  keydown: [event: KeyboardEvent];
}>();

const model = defineModel<string>({ default: "" });
const ui = useUiContext();
const attrs = useAttrs();
const generatedId = useId();
const controlId = computed(() => props.id ?? `cui-textarea-${generatedId}`);
const messageId = computed(() => `${controlId.value}-message`);
const currentAccent = computed(() => props.color ?? props.accent ?? ui.accent.value);
const controlElement = ref<HTMLElement>();
const text = ref<string>();
const editable = computed(() => !props.disabled && !props.readonly);
const showPlaceholder = computed(() => !text.value && Boolean(props.placeholder));

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

  if (props.maxlength !== undefined && next.length > props.maxlength) {
    next = next.slice(0, props.maxlength);
    target.innerText = next;
    moveCaretToEnd(target);
  }

  text.value = next;
  model.value = next;
}

function focusControl(): void {
  if (editable.value) {
    controlElement.value?.focus();
  }
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

defineExpose({ focus: focusControl });
</script>

<template>
  <SurfaceCut
    v-bind="attrs"
    :accent="currentAccent"
    :as="props.as"
    class="cui-textarea"
    :class="[
      `cui-textarea--${props.size}`,
      props.rounded && 'cui-textarea--rounded',
      props.disabled && 'cui-textarea--disabled',
    ]"
    :data-disabled="props.disabled || undefined"
    :data-invalid="!props.valid || undefined"
    :data-readonly="props.readonly || undefined"
    :hoverable="editable"
    :wrap-content="false"
  >
    <FocusRing
      v-if="editable"
      :accent="props.valid ? currentAccent : 'red'"
      :force="!props.valid"
      multiline
      :offset="!props.tightFocusRing"
      :rounded="props.rounded"
      :size="props.size"
    />
    <div
      class="cui-textarea__content"
      :class="props.contentClassName"
      data-part="wrapper"
      @contextmenu.capture.prevent
    >
      <span v-if="$slots.prefix" class="cui-textarea__affix" data-part="prefix">
        <slot name="prefix" />
      </span>
      <span
        v-if="$slots.icon"
        class="cui-textarea__icon"
        :class="props.iconClassName"
        data-part="icon"
      >
        <slot name="icon" />
      </span>
      <div class="cui-textarea__field">
        <div
          :id="controlId"
          ref="controlElement"
          :aria-describedby="props.infoMessage || props.errorMessage ? messageId : undefined"
          :aria-invalid="!props.valid || undefined"
          :aria-multiline="true"
          class="cui-textarea__control"
          :class="props.inputClassName"
          :contenteditable="editable"
          data-part="control"
          role="textbox"
          @blur="emit('blur', $event)"
          @focus="emit('focus', $event)"
          @input="onInput"
          @keydown="emit('keydown', $event)"
          @paste="onPaste"
        />
        <div
          v-if="showPlaceholder"
          aria-hidden="true"
          class="cui-textarea__placeholder"
          :class="props.placeholderClassName"
          data-part="placeholder"
        >
          {{ props.placeholder }}
        </div>
      </div>
      <span v-if="$slots.suffix" class="cui-textarea__affix" data-part="suffix">
        <slot name="suffix" />
      </span>
    </div>
    <FieldMessage v-if="props.errorMessage && !props.valid" :id="messageId" invalid visible>
      {{ props.errorMessage }}
    </FieldMessage>
    <FieldMessage
      v-else-if="props.infoMessage && !props.readonly"
      :accent="currentAccent"
      focus
      :id="messageId"
    >
      {{ props.infoMessage }}
    </FieldMessage>
  </SurfaceCut>
</template>
