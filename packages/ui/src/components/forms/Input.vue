<script setup lang="ts">
import { computed, ref, useAttrs, type Component } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import { roundedClasses } from "../../shared/roundedClasses.ts";
import { rootSizeClasses } from "../../shared/sizeClasses.ts";
import Button from "../actions/Button.vue";
import FocusRing from "../feedback/FocusRing.vue";
import SurfaceCut from "../surface/SurfaceCut.vue";
import CloseGlyph from "./CloseGlyph.vue";
import type { FieldSize } from "./form.contracts.ts";
import {
  inputClearButtonSizes,
  inputClearGlyphSizes,
  inputFontSizes,
  inputIconWrapClasses,
  inputPaddingNoIcon,
  inputPaddingWithIcon,
} from "./input.contracts.ts";

const interactiveSelector =
  'input, textarea, select, button, a, [role="button"], [tabindex]:not([tabindex="-1"])';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    as?: string | Component;
    autofocus?: boolean;
    clearButton?: boolean;
    clearLabel?: string;
    color?: UiAccent;
    contentClassName?: string;
    disabled?: boolean;
    errorMessage?: string;
    iconClassName?: string;
    infoMessage?: string;
    inputClassName?: string;
    inputId?: string;
    inputMode?: "decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url";
    max?: number | string;
    maxLength?: number;
    min?: number | string;
    name?: string;
    pattern?: string;
    placeholder?: string;
    readOnly?: boolean;
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
    as: "div",
    autofocus: false,
    clearButton: false,
    clearLabel: "Clear",
    color: undefined,
    contentClassName: undefined,
    disabled: false,
    errorMessage: undefined,
    iconClassName: undefined,
    infoMessage: undefined,
    inputClassName: undefined,
    inputId: undefined,
    inputMode: undefined,
    max: undefined,
    maxLength: undefined,
    min: undefined,
    name: undefined,
    pattern: undefined,
    placeholder: undefined,
    readOnly: false,
    required: false,
    rounded: false,
    size: "lg",
    step: undefined,
    tightFocusRing: false,
    type: "text",
    valid: true,
  },
);

const slots = defineSlots<{
  displayValue?: () => unknown;
  icon?: () => unknown;
  prefix?: () => unknown;
  suffix?: () => unknown;
}>();

const emit = defineEmits<{
  blur: [event: FocusEvent];
  change: [value: string, event: Event];
  clear: [];
  focus: [event: FocusEvent];
  keydown: [event: KeyboardEvent];
}>();

const model = defineModel<string>({ default: "" });
const ui = useUiContext();
const attrs = useAttrs();
const currentAccent = computed(() => props.color ?? props.accent ?? ui.accent.value);
const inputElement = ref<HTMLInputElement>();
const focused = ref(false);

const radii = computed(() => roundedClasses(props.size, props.rounded, false));
const heightClass = computed(() => rootSizeClasses(props.size, "height"));
const inputPadding = computed(() =>
  slots.icon ? inputPaddingWithIcon[props.size] : inputPaddingNoIcon[props.size],
);
const showDisplayValue = computed(
  () => Boolean(slots.displayValue) && (props.readOnly || !focused.value),
);

const rootClass = computed(() =>
  cn("cui-input group/cui-input", props.disabled && "opacity-50", radii.value.itemRoundedClasses),
);

const focusRingClass = computed(() =>
  props.tightFocusRing ? "rounded-[inherit]" : radii.value.focusRoundedClasses,
);

const iconClass = computed(() =>
  cn(
    "pointer-events-none absolute top-1/2 -translate-y-1/2",
    inputIconWrapClasses[props.size],
    props.iconClassName,
  ),
);

const controlClass = computed(() =>
  cn(
    inputPadding.value,
    heightClass.value,
    inputFontSizes[props.size],
    radii.value.itemRoundedClasses,
    "w-full appearance-none border-none bg-transparent font-medium shadow-none outline-none",
    props.disabled && "text-cui-fg-softer",
    "placeholder-cui-fg-softer",
    showDisplayValue.value && "text-transparent! placeholder-transparent!",
    props.inputClassName,
  ),
);

const displayValueClass = computed(() =>
  cn(
    inputPadding.value,
    heightClass.value,
    inputFontSizes[props.size],
    "pointer-events-none absolute inset-0 flex items-center font-medium",
    props.disabled && "text-cui-fg-softer",
    props.inputClassName,
  ),
);

const clearWrapClass = computed(() =>
  cn(
    "relative mr-1 shrink-0",
    rootSizeClasses(props.size, "height"),
    rootSizeClasses(props.size, "width"),
  ),
);

const clearButtonClass = computed(() =>
  cn(
    "absolute top-1 right-0 bottom-1 left-0 h-auto w-auto transform-gpu duration-200",
    !model.value && "pointer-events-none scale-0",
  ),
);

const infoClass = computed(() =>
  cn(
    "pointer-events-none absolute -top-1.5 left-2 z-10 translate-y-0 rounded-cui-xs bg-cui-primary px-2 py-0.5 text-cui-2xs leading-none font-semibold text-cui-on-primary opacity-0 duration-200 group-has-[input:focus]/cui-input:-translate-y-1/2 group-has-[input:focus]/cui-input:opacity-100",
    `cui-accent-${currentAccent.value}`,
  ),
);

const errorClass =
  "cui-accent-red pointer-events-none absolute -top-1.5 left-2 z-10 -translate-y-1/2 rounded-cui-xs bg-cui-primary px-2 py-0.5 text-cui-2xs leading-none font-semibold text-cui-on-primary opacity-100 duration-200";

function onInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  model.value = value;
  emit("change", value, event);
}

function onFocus(event: FocusEvent): void {
  focused.value = true;
  emit("focus", event);
}

function onBlur(event: FocusEvent): void {
  focused.value = false;
  emit("blur", event);
}

function onPointerDown(event: PointerEvent): void {
  if (event.pointerType === "touch") return;
  if ((event.target as HTMLElement).closest(interactiveSelector)) return;
  event.preventDefault();
  inputElement.value?.focus();
}

function onClick(event: MouseEvent): void {
  if ((event.target as HTMLElement).closest(interactiveSelector)) return;
  inputElement.value?.focus();
}

function clearValue(): void {
  model.value = "";
  emit("clear");
}

defineExpose({
  focus: () => inputElement.value?.focus(),
  select: () => inputElement.value?.select(),
});
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
    :data-required="props.required || undefined"
    :hoverable="!props.disabled && !props.readOnly"
    :wrap-content="false"
  >
    <FocusRing
      v-if="!props.readOnly && !props.disabled"
      :class="focusRingClass"
      :color="props.valid ? currentAccent : 'red'"
      :force="!props.valid"
      group="input"
      :offset="!props.tightFocusRing"
    />

    <div
      :class="cn('relative flex items-center', props.contentClassName)"
      data-part="wrapper"
      @click="onClick"
      @contextmenu.capture.prevent
      @pointerdown="onPointerDown"
    >
      <slot name="prefix" />
      <div v-if="$slots.icon" :class="iconClass" data-part="icon">
        <slot name="icon" />
      </div>

      <div class="relative flex w-full">
        <input
          :id="props.inputId"
          ref="inputElement"
          :autofocus="props.autofocus"
          :class="controlClass"
          data-part="control"
          :disabled="props.disabled"
          :inputmode="props.inputMode"
          :max="props.max"
          :maxlength="props.maxLength"
          :min="props.min"
          :name="props.name"
          :pattern="props.pattern"
          :placeholder="props.placeholder"
          :readonly="props.readOnly"
          :required="props.required"
          :step="props.step"
          :tabindex="props.disabled || props.readOnly ? -1 : undefined"
          :type="props.type"
          :value="model"
          @blur="onBlur"
          @focus="onFocus"
          @input="onInput"
          @keydown="emit('keydown', $event)"
        />

        <span v-if="showDisplayValue" :class="displayValueClass" data-part="display-value">
          <slot name="displayValue" />
        </span>
      </div>

      <div v-if="props.clearButton && !props.disabled && !props.readOnly" :class="clearWrapClass">
        <Button
          :aria-label="props.clearLabel"
          :class="clearButtonClass"
          content-class-name="px-0"
          data-part="clear"
          :disabled="!model"
          :outline="false"
          :rounded="props.rounded"
          :size="inputClearButtonSizes[props.size]"
          :tabindex="-1"
          @click="clearValue"
        >
          <CloseGlyph :class="cn('text-cui-fg-soft', inputClearGlyphSizes[props.size])" />
        </Button>
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
