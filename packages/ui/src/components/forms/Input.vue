<script setup lang="ts">
import { computed, ref, useAttrs, useId } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
import Button from "../actions/Button.vue";
import FocusRing from "../feedback/FocusRing.vue";
import SurfaceCut from "../surface/SurfaceCut.vue";
import CloseGlyph from "./CloseGlyph.vue";
import FieldMessage from "./FieldMessage.vue";
import type { FieldSize } from "./form.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    autocomplete?: string;
    autofocus?: boolean;
    clearLabel?: string;
    clearable?: boolean;
    disabled?: boolean;
    errorMessage?: string;
    id?: string;
    infoMessage?: string;
    inputMode?: "decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url";
    max?: number | string;
    maxlength?: number;
    min?: number | string;
    name?: string;
    pattern?: string;
    placeholder?: string;
    readonly?: boolean;
    required?: boolean;
    rounded?: boolean;
    size?: FieldSize;
    step?: number | string;
    tightFocusRing?: boolean;
    type?: string;
    valid?: boolean;
  }>(),
  {
    accent: undefined,
    autocomplete: undefined,
    autofocus: false,
    clearLabel: "Clear",
    clearable: false,
    disabled: false,
    errorMessage: undefined,
    id: undefined,
    infoMessage: undefined,
    inputMode: undefined,
    max: undefined,
    maxlength: undefined,
    min: undefined,
    name: undefined,
    pattern: undefined,
    placeholder: undefined,
    readonly: false,
    required: false,
    rounded: false,
    size: "lg",
    step: undefined,
    tightFocusRing: false,
    type: "text",
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
  clear: [];
  focus: [event: FocusEvent];
}>();

const model = defineModel<string>({ default: "" });
const ui = useUiContext();
const attrs = useAttrs();
const generatedId = useId();
const inputId = computed(() => props.id ?? `cui-input-${generatedId}`);
const messageId = computed(() => `${inputId.value}-message`);
const currentAccent = computed(() => props.accent ?? ui.accent.value);
const inputElement = ref<HTMLInputElement>();

function updateValue(event: Event): void {
  model.value = (event.target as HTMLInputElement).value;
}

function clearValue(): void {
  model.value = "";
  emit("clear");
  inputElement.value?.focus();
}

function focusControl(): void {
  if (!props.disabled) {
    inputElement.value?.focus();
  }
}

defineExpose({
  focus: focusControl,
  select: () => inputElement.value?.select(),
});
</script>

<template>
  <SurfaceCut
    :accent="currentAccent"
    class="cui-input"
    :class="[
      `cui-input--${props.size}`,
      props.rounded && 'cui-input--rounded',
      props.disabled && 'cui-input--disabled',
    ]"
    :data-invalid="!props.valid || undefined"
    :data-readonly="props.readonly || undefined"
    :hoverable="!props.disabled && !props.readonly"
    :outline="true"
    :wrap-content="false"
    @click="focusControl"
  >
    <FocusRing
      v-if="!props.disabled && !props.readonly"
      :accent="props.valid ? currentAccent : 'red'"
      :force="!props.valid"
      :offset="!props.tightFocusRing"
      :rounded="props.rounded"
      :size="props.size"
    />
    <div class="cui-input__content" data-part="wrapper">
      <span v-if="$slots.prefix" class="cui-input__affix" data-part="prefix"
        ><slot name="prefix"
      /></span>
      <span v-if="$slots.icon" class="cui-input__icon" data-part="icon"><slot name="icon" /></span>
      <input
        :id="inputId"
        ref="inputElement"
        v-bind="attrs"
        :aria-describedby="props.infoMessage || props.errorMessage ? messageId : undefined"
        :aria-invalid="!props.valid || undefined"
        :autocomplete="props.autocomplete"
        :autofocus="props.autofocus"
        class="cui-input__control"
        data-part="control"
        :disabled="props.disabled"
        :inputmode="props.inputMode"
        :max="props.max"
        :maxlength="props.maxlength"
        :min="props.min"
        :name="props.name"
        :pattern="props.pattern"
        :placeholder="props.placeholder"
        :readonly="props.readonly"
        :required="props.required"
        :step="props.step"
        :type="props.type"
        :value="model"
        @blur="emit('blur', $event)"
        @focus="emit('focus', $event)"
        @input="updateValue"
      />
      <Button
        v-if="props.clearable && !props.disabled && !props.readonly"
        :aria-hidden="!model || undefined"
        :aria-label="props.clearLabel"
        class="cui-input__clear"
        :disabled="!model"
        rounded
        :size="
          props.size === 'sm'
            ? '2xs'
            : props.size === 'md'
              ? 'xs'
              : props.size === 'lg'
                ? 'sm'
                : props.size === 'xl'
                  ? 'md'
                  : 'lg'
        "
        square
        :tabindex="model ? 0 : -1"
        variant="transparent"
        @click.stop="clearValue"
      >
        <CloseGlyph />
      </Button>
      <span v-if="$slots.suffix" class="cui-input__affix" data-part="suffix"
        ><slot name="suffix"
      /></span>
    </div>
    <FieldMessage v-if="props.errorMessage && !props.valid" :id="messageId" invalid visible>
      {{ props.errorMessage }}
    </FieldMessage>
    <FieldMessage
      v-else-if="props.infoMessage && !props.readonly"
      :accent="currentAccent"
      :id="messageId"
      class="cui-field-message--focus"
    >
      {{ props.infoMessage }}
    </FieldMessage>
  </SurfaceCut>
</template>
