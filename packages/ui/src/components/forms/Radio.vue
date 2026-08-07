<script setup lang="ts">
import { computed, inject, type Component } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
import FocusRing from "../feedback/FocusRing.vue";
import { cn } from "../../shared/cn.ts";
import Surface from "../surface/Surface.vue";
import type { ChoiceSize } from "./form.contracts.ts";
import { radioIndicatorSizes, radioRootSizes } from "./radio.contracts.ts";
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

const rootClass = computed(() =>
  cn(
    "cui-radio group/cui-radio relative flex shrink-0 items-center justify-center rounded-full select-none",
    radioRootSizes[props.size],
    disabled.value && "opacity-50",
  ),
);

const thumbClass = "absolute inset-0 size-full shrink-0 rounded-full duration-200";

const checkedThumbClass = computed(() =>
  cn(thumbClass, !checked.value && "scale-0", checked.value ? "opacity-100" : "opacity-0"),
);

const indicatorClass = computed(() =>
  cn(
    "cui-radio__indicator pointer-events-none relative rounded-full duration-200",
    radioIndicatorSizes[props.size],
    !checked.value && "scale-75 bg-cui-fg-soft",
    !checked.value && !isReadOnly.value && !disabled.value && "group-active/cui-radio:scale-65",
    checked.value && `cui-accent-${currentAccent.value}`,
    checked.value && "bg-cui-on-primary",
    checked.value && !disabled.value && !isReadOnly.value && "group-active/cui-radio:scale-90",
  ),
);
</script>

<template>
  <component
    :is="props.as"
    v-bind="$attrs"
    :class="rootClass"
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
    @contextmenu.capture.prevent
    @keydown="handleFallbackKeydown"
  >
    <input
      v-if="props.input"
      :id="inputId"
      class="pointer-events-none absolute inset-1 z-10 opacity-0"
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
      :class="thumbClass"
      :clickable="hoverable && !disabled && !isReadOnly"
      data-part="thumb"
      :hoverable="hoverable && !disabled && !isReadOnly"
      :outline="props.thumbOutline"
      variant="gradient"
      :wrap-content="false"
    />
    <Surface
      as="span"
      :class="checkedThumbClass"
      :clickable="hoverable && !disabled && !isReadOnly"
      :color="currentAccent"
      data-part="thumb-checked"
      :hoverable="hoverable && !disabled && !isReadOnly"
      :outline="props.thumbOutline"
      variant="gradient-fill"
      :wrap-content="false"
    />
    <span :class="indicatorClass" data-part="indicator" />
    <FocusRing v-if="focusable && !disabled && !isReadOnly" class="rounded-full" group="radio" />
  </component>
</template>
