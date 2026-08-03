<script setup lang="ts">
import { computed, ref, useAttrs, useId, watch } from "vue";

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
    autofocus?: boolean;
    disabled?: boolean;
    errorMessage?: string;
    id?: string;
    infoMessage?: string;
    maxlength?: number;
    name?: string;
    placeholder?: string;
    readonly?: boolean;
    required?: boolean;
    resize?: "both" | "horizontal" | "none" | "vertical";
    rounded?: boolean;
    rows?: number;
    size?: FieldSize;
    tightFocusRing?: boolean;
    valid?: boolean;
  }>(),
  {
    accent: undefined,
    autofocus: false,
    disabled: false,
    errorMessage: undefined,
    id: undefined,
    infoMessage: undefined,
    maxlength: undefined,
    name: undefined,
    placeholder: undefined,
    readonly: false,
    required: false,
    resize: "vertical",
    rounded: false,
    rows: 3,
    size: "lg",
    tightFocusRing: false,
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
}>();

const model = defineModel<string>({ default: "" });
const ui = useUiContext();
const attrs = useAttrs();
const generatedId = useId();
const controlId = computed(() => props.id ?? `cui-textarea-${generatedId}`);
const messageId = computed(() => `${controlId.value}-message`);
const currentAccent = computed(() => props.accent ?? ui.accent.value);
const controlElement = ref<HTMLTextAreaElement>();

function updateValue(event: Event): void {
  model.value = (event.target as HTMLTextAreaElement).value;
}

function focusControl(): void {
  if (!props.disabled) {
    controlElement.value?.focus();
  }
}

watch(
  [model, controlElement],
  ([value, element]) => {
    if (element) element.defaultValue = value;
  },
  { flush: "post", immediate: true },
);

defineExpose({ focus: focusControl });
</script>

<template>
  <SurfaceCut
    :accent="currentAccent"
    class="cui-textarea"
    :class="[
      `cui-textarea--${props.size}`,
      props.rounded && 'cui-textarea--rounded',
      props.disabled && 'cui-textarea--disabled',
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
      multiline
      :offset="!props.tightFocusRing"
      :rounded="props.rounded"
      :size="props.size"
    />
    <div class="cui-textarea__content" data-part="wrapper">
      <span v-if="$slots.prefix" class="cui-input__affix" data-part="prefix"
        ><slot name="prefix"
      /></span>
      <span v-if="$slots.icon" class="cui-textarea__icon" data-part="icon"
        ><slot name="icon"
      /></span>
      <textarea
        :id="controlId"
        ref="controlElement"
        v-bind="attrs"
        :aria-describedby="props.infoMessage || props.errorMessage ? messageId : undefined"
        :aria-invalid="!props.valid || undefined"
        :autofocus="props.autofocus"
        class="cui-textarea__control"
        data-part="control"
        :disabled="props.disabled"
        :maxlength="props.maxlength"
        :name="props.name"
        :placeholder="props.placeholder"
        :readonly="props.readonly"
        :required="props.required"
        :rows="props.rows"
        :style="{ resize: props.resize }"
        :value="model"
        @blur="emit('blur', $event)"
        @focus="emit('focus', $event)"
        @input="updateValue"
      />
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
