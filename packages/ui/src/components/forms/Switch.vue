<script setup lang="ts">
import { computed, type Component } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { SurfaceLevelInput, SurfaceVariant, UiAccent } from "../../foundations/contracts.ts";
import FocusRing from "../feedback/FocusRing.vue";
import Surface from "../surface/Surface.vue";
import type { SwitchSize } from "./form.contracts.ts";

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
    outline?: boolean;
    readOnly?: boolean;
    readonly?: boolean;
    required?: boolean;
    size?: SwitchSize;
    surfaceLevel?: SurfaceLevelInput;
    thumbOutline?: boolean;
    thumbSurfaceLevel?: SurfaceLevelInput;
    thumbVariant?: SurfaceVariant;
    value?: string;
    variant?: SurfaceVariant;
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
    outline: true,
    readOnly: undefined,
    readonly: undefined,
    required: false,
    size: "md",
    surfaceLevel: "+1",
    thumbOutline: true,
    thumbSurfaceLevel: "+2",
    thumbVariant: "gradient",
    value: "on",
    variant: "solid",
  },
);

defineSlots<{
  icon?: (props: { checked: boolean }) => unknown;
}>();

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
  setChecked(!checked.value, event);
}
</script>

<template>
  <component
    :is="props.as"
    v-bind="$attrs"
    class="cui-switch"
    :class="[
      `cui-switch--${props.size}`,
      props.disabled && 'cui-switch--disabled',
      isReadOnly && 'cui-switch--readonly',
    ]"
    :aria-checked="!props.input ? checked : undefined"
    :aria-disabled="!props.input && props.disabled ? 'true' : undefined"
    :aria-readonly="!props.input && isReadOnly ? 'true' : undefined"
    :data-checked="checked || undefined"
    :data-disabled="props.disabled || undefined"
    :data-readonly="isReadOnly || undefined"
    :data-state="checked ? 'checked' : 'unchecked'"
    :data-unchecked="!checked || undefined"
    :role="!props.input ? 'switch' : undefined"
    :tabindex="!props.input ? (props.disabled ? -1 : 0) : undefined"
    @click="handleRootClick"
    @keydown="handleFallbackKeydown"
  >
    <input
      v-if="props.input"
      :id="inputId"
      class="cui-choice__input"
      data-part="input"
      :aria-checked="checked"
      :checked="checked"
      :disabled="props.disabled || isReadOnly"
      :name="props.name"
      :readonly="isReadOnly"
      :required="props.required"
      role="switch"
      type="checkbox"
      :value="props.value"
      @change="handleInputChange"
    />
    <Surface
      as="span"
      class="cui-switch__track"
      :level="props.surfaceLevel"
      :outline="props.outline"
      :variant="props.variant"
      :wrap-content="false"
    />
    <Surface
      as="span"
      class="cui-switch__thumb"
      :clickable="!props.disabled && !isReadOnly"
      :hoverable="hoverable && !props.disabled && !isReadOnly"
      :level="props.thumbSurfaceLevel"
      :outline="props.thumbOutline"
      :variant="props.thumbVariant"
    >
      <template #beforeContent>
        <Surface
          as="span"
          :color="currentAccent"
          class="cui-switch__thumb-fill"
          :clickable="hoverable && !props.disabled && !isReadOnly"
          :hoverable="hoverable && !props.disabled && !isReadOnly"
          outline
          variant="gradient-fill"
          :wrap-content="false"
        />
      </template>
      <slot name="icon" :checked="checked">
        <span class="cui-switch__glyph" aria-hidden="true" data-part="indicator">
          <span class="cui-switch__glyph-line cui-switch__glyph-line--first" />
          <span class="cui-switch__glyph-line cui-switch__glyph-line--second" />
        </span>
      </slot>
      <FocusRing
        v-if="focusable && !props.disabled && !isReadOnly"
        rounded
        :accent="currentAccent"
      />
    </Surface>
  </component>
</template>
