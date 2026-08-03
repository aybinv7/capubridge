<script setup lang="ts">
import { computed, type Component } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
import FocusRing from "../feedback/FocusRing.vue";
import Surface from "../surface/Surface.vue";
import CheckboxGlyph from "./CheckboxGlyph.vue";
import type { ChoiceSize } from "./form.contracts.ts";

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
</script>

<template>
  <component
    :is="props.as"
    v-bind="$attrs"
    class="cui-checkbox"
    :class="[
      `cui-checkbox--${props.size}`,
      props.disabled && 'cui-checkbox--disabled',
      isReadOnly && 'cui-checkbox--readonly',
    ]"
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
      class="cui-choice__surface cui-choice__surface--idle"
      :clickable="hoverable && !props.disabled && !isReadOnly"
      :hoverable="hoverable && !props.disabled && !isReadOnly"
      :outline="props.thumbOutline"
      variant="gradient"
      :wrap-content="false"
    />
    <Surface
      as="span"
      :color="currentAccent"
      class="cui-choice__surface cui-choice__surface--active"
      :clickable="hoverable && !props.disabled && !isReadOnly"
      :hoverable="hoverable && !props.disabled && !isReadOnly"
      :outline="props.thumbOutline"
      variant="gradient-fill"
      :wrap-content="false"
    />
    <CheckboxGlyph
      class="cui-checkbox__indicator"
      :class="props.checkClassName"
      data-part="indicator"
      :data-state="checked ? 'checked' : 'unchecked'"
    />
    <FocusRing v-if="focusable && !props.disabled && !isReadOnly" rounded :accent="currentAccent" />
  </component>
</template>
