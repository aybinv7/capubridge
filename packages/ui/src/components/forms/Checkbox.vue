<script setup lang="ts">
import { computed, type Component } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
import FocusRing from "../feedback/FocusRing.vue";
import { cn } from "../../shared/cn.ts";
import Surface from "../surface/Surface.vue";
import CheckboxGlyph from "./CheckboxGlyph.vue";
import type { ChoiceSize } from "./form.contracts.ts";
import { checkboxIndicatorSizes, checkboxRootSizes } from "./checkbox.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    as?: string | Component;
    checkClassName?: string;
    checked?: boolean;
    color?: UiAccent;
    disabled?: boolean;
    focusable?: boolean;
    hoverable?: boolean;
    id?: string;
    input?: boolean;
    inputId?: string;
    name?: string;
    readOnly?: boolean;
    readonly?: boolean;
    required?: boolean;
    size?: ChoiceSize;
    thumbOutline?: boolean;
    value?: string;
  }>(),
  {
    accent: undefined,
    as: "label",
    checkClassName: undefined,
    checked: undefined,
    color: undefined,
    disabled: false,
    focusable: undefined,
    hoverable: undefined,
    id: undefined,
    input: true,
    inputId: undefined,
    name: undefined,
    readOnly: undefined,
    readonly: undefined,
    required: false,
    size: "sm",
    thumbOutline: true,
    value: undefined,
  },
);

const model = defineModel<boolean>({ default: false });
const emit = defineEmits<{
  change: [checked: boolean, event?: Event];
  "update:checked": [checked: boolean];
}>();
const ui = useUiContext();
const isReadOnly = computed(() => props.readOnly ?? props.readonly ?? false);
const checked = computed(() => props.checked ?? model.value);
const currentAccent = computed(() => props.color ?? props.accent ?? ui.accent.value);
const hoverable = computed(() => props.hoverable ?? props.as === "label");
const focusable = computed(() => props.focusable ?? (props.as === "label" || props.input));
const inputId = computed(() => props.inputId ?? props.id);

function setChecked(next: boolean, event?: Event): void {
  if (props.disabled || isReadOnly.value) return;

  model.value = next;
  emit("update:checked", next);
  emit("change", next, event);
}

function handleInputChange(event: Event): void {
  setChecked((event.target as HTMLInputElement).checked, event);
}

function handleRootClick(event: MouseEvent): void {
  if (!props.input) {
    setChecked(!checked.value, event);
    return;
  }

  if (event.target instanceof HTMLInputElement) return;

  event.preventDefault();
  setChecked(!checked.value, event);
}

function handleFallbackKeydown(event: KeyboardEvent): void {
  if (props.input || props.disabled || isReadOnly.value) return;
  if (event.key !== " " && event.key !== "Enter") return;

  event.preventDefault();
  setChecked(!checked.value);
}

const rootClass = computed(() =>
  cn(
    "cui-checkbox group/cui-checkbox relative flex shrink-0 items-center justify-center rounded-full select-none",
    checkboxRootSizes[props.size],
    props.disabled && "opacity-50",
  ),
);

const thumbClass = "absolute inset-0 size-full shrink-0 rounded-full duration-200";

const checkedThumbClass = computed(() =>
  cn(thumbClass, !checked.value && "scale-0", checked.value ? "opacity-100" : "opacity-0"),
);

const indicatorClass = computed(() =>
  cn(
    "cui-checkbox__indicator pointer-events-none relative duration-200",
    checkboxIndicatorSizes[props.size],
    !checked.value && "scale-75 text-cui-fg-soft",
    checked.value && !props.disabled && !isReadOnly.value && "group-active/cui-checkbox:scale-90",
    !checked.value && !props.disabled && !isReadOnly.value && "group-active/cui-checkbox:scale-65",
    checked.value && "text-cui-on-primary",
    checked.value && `cui-accent-${currentAccent.value}`,
    props.checkClassName,
  ),
);
</script>

<template>
  <component
    :is="props.as"
    v-bind="$attrs"
    :class="rootClass"
    :aria-checked="!props.input ? checked : undefined"
    :aria-disabled="!props.input && props.disabled ? 'true' : undefined"
    :aria-readonly="!props.input && isReadOnly ? 'true' : undefined"
    :aria-required="!props.input && props.required ? 'true' : undefined"
    :data-checked="checked || undefined"
    :data-disabled="props.disabled || undefined"
    :data-readonly="isReadOnly || undefined"
    :data-required="props.required || undefined"
    :data-state="checked ? 'checked' : 'unchecked'"
    :data-unchecked="!checked || undefined"
    :role="!props.input ? 'checkbox' : undefined"
    :tabindex="!props.input ? (props.disabled ? -1 : 0) : undefined"
    @click="handleRootClick"
    @keydown="handleFallbackKeydown"
  >
    <input
      v-if="props.input"
      :id="inputId"
      class="cui-choice__input"
      data-part="input"
      :checked="checked"
      :disabled="props.disabled || isReadOnly"
      :name="props.name"
      :readonly="isReadOnly"
      :required="props.required"
      type="checkbox"
      :value="props.value"
      @change="handleInputChange"
    />
    <Surface
      as="span"
      :class="thumbClass"
      data-part="thumb"
      :clickable="hoverable && !props.disabled && !isReadOnly"
      :hoverable="hoverable && !props.disabled && !isReadOnly"
      :outline="props.thumbOutline"
      variant="gradient"
      :wrap-content="false"
    />
    <Surface
      as="span"
      :color="currentAccent"
      :class="checkedThumbClass"
      data-part="thumb-checked"
      :clickable="hoverable && !props.disabled && !isReadOnly"
      :hoverable="hoverable && !props.disabled && !isReadOnly"
      :outline="props.thumbOutline"
      variant="gradient-fill"
      :wrap-content="false"
    />
    <CheckboxGlyph
      :class="indicatorClass"
      data-part="indicator"
      :data-state="checked ? 'checked' : 'unchecked'"
    />
    <FocusRing
      v-if="focusable && !props.disabled && !isReadOnly"
      :accent="currentAccent"
      class="rounded-full"
      group="checkbox"
    />
  </component>
</template>
