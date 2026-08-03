<script setup lang="ts">
import { computed, inject, type Component } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
import FocusRing from "../feedback/FocusRing.vue";
import Surface from "../surface/Surface.vue";
import type { ChoiceSize } from "./form.contracts.ts";
import { radioGroupKey } from "./radioGroupContext.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    as?: string | Component;
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
const group = inject(radioGroupKey, undefined);
const ui = useUiContext();
const isReadOnly = computed(() => props.readOnly ?? props.readonly ?? false);
const checked = computed(() => {
  if (group) return group.value.value === props.value;
  return props.checked ?? model.value;
});
const disabled = computed(() => props.disabled || group?.disabled.value === true);
const name = computed(() => props.name ?? group?.name.value);
const required = computed(() => props.required || group?.required.value === true);
const currentAccent = computed(() => props.color ?? props.accent ?? ui.accent.value);
const hoverable = computed(() => props.hoverable ?? props.as === "label");
const focusable = computed(() => props.focusable ?? (props.as === "label" || props.input));
const inputId = computed(() => props.inputId ?? props.id);

function setChecked(next: boolean, event?: Event): void {
  if (disabled.value || isReadOnly.value) return;

  if (group) {
    if (props.value !== undefined) group.value.value = props.value;
  } else {
    model.value = next;
    emit("update:checked", next);
  }

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
  if (props.input || disabled.value || isReadOnly.value) return;
  if (event.key !== " " && event.key !== "Enter") return;

  event.preventDefault();
  setChecked(!checked.value, event);
}
</script>

<template>
  <component
    :is="props.as"
    v-bind="$attrs"
    class="cui-radio"
    :class="[
      `cui-radio--${props.size}`,
      disabled && 'cui-radio--disabled',
      isReadOnly && 'cui-radio--readonly',
    ]"
    :aria-checked="!props.input ? checked : undefined"
    :aria-disabled="!props.input && disabled ? 'true' : undefined"
    :aria-readonly="!props.input && isReadOnly ? 'true' : undefined"
    :aria-required="!props.input && required ? 'true' : undefined"
    :data-checked="checked || undefined"
    :data-disabled="disabled || undefined"
    :data-readonly="isReadOnly || undefined"
    :data-required="required || undefined"
    :data-state="checked ? 'checked' : 'unchecked'"
    :data-unchecked="!checked || undefined"
    :role="!props.input ? 'radio' : undefined"
    :tabindex="!props.input ? (disabled ? -1 : 0) : undefined"
    @click="handleRootClick"
    @keydown="handleFallbackKeydown"
  >
    <input
      v-if="props.input"
      :id="inputId"
      class="cui-choice__input"
      data-part="input"
      :checked="checked"
      :disabled="disabled || isReadOnly"
      :name="name"
      :readonly="isReadOnly"
      :required="required"
      type="checkbox"
      :value="props.value"
      @change="handleInputChange"
    />
    <Surface
      as="span"
      class="cui-choice__surface cui-choice__surface--idle"
      :clickable="hoverable && !disabled && !isReadOnly"
      :hoverable="hoverable && !disabled && !isReadOnly"
      :outline="props.thumbOutline"
      variant="gradient"
      :wrap-content="false"
    />
    <Surface
      as="span"
      :color="currentAccent"
      class="cui-choice__surface cui-choice__surface--active"
      :clickable="hoverable && !disabled && !isReadOnly"
      :hoverable="hoverable && !disabled && !isReadOnly"
      :outline="props.thumbOutline"
      variant="gradient-fill"
      :wrap-content="false"
    />
    <span class="cui-radio__indicator" data-part="indicator" />
    <FocusRing v-if="focusable && !disabled && !isReadOnly" rounded :accent="currentAccent" />
  </component>
</template>
