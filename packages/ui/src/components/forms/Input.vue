<script setup lang="ts">
import { computed, ref, useAttrs } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import { cn } from "../../shared/cn.ts";
import { roundedClasses } from "../../shared/roundedClasses.ts";
import { rootSizeClasses } from "../../shared/sizeClasses.ts";
import Button from "../actions/Button.vue";
import FocusRing from "../feedback/FocusRing.vue";
import SurfaceCut from "../surface/SurfaceCut.vue";
import CloseIcon from "../feedback/CloseIcon.vue";
import {
  inputClearButtonSizes,
  inputClearGlyphSizes,
  inputFontSizes,
  inputIconWrapClasses,
  inputPaddingNoIcon,
  inputPaddingWithIcon,
  type InputProps,
} from "./input.contracts.ts";

const interactiveSelector =
  'input, textarea, select, button, a, [role="button"], [tabindex]:not([tabindex="-1"])';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<InputProps>(), {
  accent: undefined,
  as: undefined,
  autofocus: undefined,
  clearButton: undefined,
  clearLabel: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
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
  readOnly: undefined,
  required: undefined,
  rounded: undefined,
  size: undefined,
  step: undefined,
  tightFocusRing: undefined,
  type: undefined,
  valid: undefined,
});

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
const d = useComponentDefaults("Input", props, {
  as: "div" as InputProps["as"],
  autofocus: false,
  clearButton: false,
  clearLabel: "Clear",
  disabled: false,
  readOnly: false,
  required: false,
  rounded: false,
  size: "lg" as InputProps["size"],
  tightFocusRing: false,
  type: "text",
  valid: true,
});
const currentAccent = computed(() => d.value.color ?? d.value.accent ?? ui.accentColor.value);
const inputElement = ref<HTMLInputElement>();
const focused = ref(false);

const radii = computed(() => roundedClasses(d.value.size, d.value.rounded, false));
const heightClass = computed(() => rootSizeClasses(d.value.size, "height"));
const inputPadding = computed(() =>
  slots.icon ? inputPaddingWithIcon[d.value.size] : inputPaddingNoIcon[d.value.size],
);
const showDisplayValue = computed(
  () => Boolean(slots.displayValue) && (d.value.readOnly || !focused.value),
);

const rootClass = computed(() =>
  cn("cui-input group/cui-input", d.value.disabled && "opacity-50", radii.value.itemRoundedClasses),
);

const focusRingClass = computed(() =>
  d.value.tightFocusRing ? "rounded-[inherit]" : radii.value.focusRoundedClasses,
);

const iconClass = computed(() =>
  cn(
    "pointer-events-none absolute top-1/2 -translate-y-1/2",
    inputIconWrapClasses[d.value.size],
    d.value.iconClassName,
  ),
);

const controlClass = computed(() =>
  cn(
    inputPadding.value,
    heightClass.value,
    inputFontSizes[d.value.size],
    radii.value.itemRoundedClasses,
    "w-full appearance-none border-none bg-transparent font-medium shadow-none outline-none",
    d.value.disabled && "text-cui-fg-softer",
    "placeholder-cui-fg-softer",
    showDisplayValue.value && "text-transparent! placeholder-transparent!",
    d.value.inputClassName,
  ),
);

const displayValueClass = computed(() =>
  cn(
    inputPadding.value,
    heightClass.value,
    inputFontSizes[d.value.size],
    "pointer-events-none absolute inset-0 flex items-center font-medium",
    d.value.disabled && "text-cui-fg-softer",
    d.value.inputClassName,
  ),
);

const clearWrapClass = computed(() =>
  cn(
    "relative mr-1 shrink-0",
    rootSizeClasses(d.value.size, "height"),
    rootSizeClasses(d.value.size, "width"),
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
    `cui-color-${currentAccent.value}`,
  ),
);

const errorClass =
  "cui-color-red pointer-events-none absolute -top-1.5 left-2 z-10 -translate-y-1/2 rounded-cui-xs bg-cui-primary px-2 py-0.5 text-cui-2xs leading-none font-semibold text-cui-on-primary opacity-100 duration-200";

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
    :accent="d.accent"
    :as="d.as"
    :class="rootClass"
    :color="d.color"
    :data-disabled="d.disabled || undefined"
    :data-invalid="!d.valid || undefined"
    :data-readonly="d.readOnly || undefined"
    :data-required="d.required || undefined"
    :hoverable="!d.disabled && !d.readOnly"
    :wrap-content="false"
  >
    <FocusRing
      v-if="!d.readOnly && !d.disabled"
      :class="focusRingClass"
      :color="d.valid ? currentAccent : 'red'"
      :force="!d.valid"
      group="input"
      :offset="!d.tightFocusRing"
    />

    <div
      :class="cn('relative flex items-center', d.contentClassName)"
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
          :id="d.inputId"
          ref="inputElement"
          :autofocus="d.autofocus"
          :class="controlClass"
          data-part="control"
          :disabled="d.disabled"
          :inputmode="d.inputMode"
          :max="d.max"
          :maxlength="d.maxLength"
          :min="d.min"
          :name="d.name"
          :pattern="d.pattern"
          :placeholder="d.placeholder"
          :readonly="d.readOnly"
          :required="d.required"
          :step="d.step"
          :tabindex="d.disabled || d.readOnly ? -1 : undefined"
          :type="d.type"
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

      <div v-if="d.clearButton && !d.disabled && !d.readOnly" :class="clearWrapClass">
        <Button
          :aria-label="d.clearLabel"
          :class="clearButtonClass"
          content-class-name="px-0"
          data-part="clear"
          :disabled="!model"
          :outline="false"
          :rounded="d.rounded"
          :size="inputClearButtonSizes[d.size]"
          :tabindex="-1"
          @click="clearValue"
        >
          <CloseIcon :class="cn('text-cui-fg-soft', inputClearGlyphSizes[d.size])" />
        </Button>
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
