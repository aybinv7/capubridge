<script setup lang="ts">
import { computed, inject } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import FocusRing from "../feedback/FocusRing.vue";
import { cn } from "../../shared/cn.ts";
import Surface from "../surface/Surface.vue";
import { radioIndicatorSizes, radioRootSizes, type RadioProps } from "./radio.contracts.ts";
import { radioGroupKey } from "./radioGroupContext.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<RadioProps>(), {
  accent: undefined,
  as: undefined,
  checked: undefined,
  color: undefined,
  disabled: undefined,
  focusable: undefined,
  hoverable: undefined,
  id: undefined,
  input: undefined,
  inputId: undefined,
  name: undefined,
  readOnly: undefined,
  readonly: undefined,
  required: undefined,
  size: undefined,
  thumbOutline: undefined,
  value: undefined,
});

const model = defineModel<boolean>({ default: false });
const emit = defineEmits<{
  change: [checked: boolean, event?: Event];
  "update:checked": [checked: boolean];
}>();
const group = inject(radioGroupKey, undefined);
const ui = useUiContext();
const d = useComponentDefaults("Radio", props, {
  as: "label" as RadioProps["as"],
  disabled: false,
  input: true,
  required: false,
  size: "sm" as RadioProps["size"],
  thumbOutline: true,
});
const isReadOnly = computed(() => d.value.readOnly ?? d.value.readonly ?? false);
const checked = computed(() => {
  if (group) return group.value.value === d.value.value;
  return d.value.checked ?? model.value;
});
const disabled = computed(() => d.value.disabled || group?.disabled.value === true);
const name = computed(() => d.value.name ?? group?.name.value);
const required = computed(() => d.value.required || group?.required.value === true);
const currentAccent = computed(() => d.value.color ?? d.value.accent ?? ui.accentColor.value);
const hoverable = computed(() => d.value.hoverable ?? d.value.as === "label");
const focusable = computed(() => d.value.focusable ?? (d.value.as === "label" || d.value.input));
const inputId = computed(() => d.value.inputId ?? d.value.id);

function setChecked(next: boolean, event?: Event): void {
  if (disabled.value || isReadOnly.value) return;

  if (group) {
    if (d.value.value !== undefined) group.value.value = d.value.value;
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
  if (!d.value.input) {
    setChecked(!checked.value, event);
    return;
  }

  if (event.target instanceof HTMLInputElement) return;

  event.preventDefault();
  setChecked(!checked.value, event);
}

function handleFallbackKeydown(event: KeyboardEvent): void {
  if (d.value.input || disabled.value || isReadOnly.value) return;
  if (event.key !== " " && event.key !== "Enter") return;

  event.preventDefault();
  setChecked(!checked.value, event);
}

const rootClass = computed(() =>
  cn(
    "cui-radio group/cui-radio relative flex shrink-0 items-center justify-center rounded-full select-none",
    radioRootSizes[d.value.size],
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
    radioIndicatorSizes[d.value.size],
    !checked.value && "scale-75 bg-cui-fg-soft",
    !checked.value && !isReadOnly.value && !disabled.value && "group-active/cui-radio:scale-65",
    checked.value && `cui-color-${currentAccent.value}`,
    checked.value && "bg-cui-on-primary",
    checked.value && !disabled.value && !isReadOnly.value && "group-active/cui-radio:scale-90",
  ),
);
</script>

<template>
  <component
    :is="d.as"
    v-bind="$attrs"
    :class="rootClass"
    :aria-checked="!d.input ? checked : undefined"
    :aria-disabled="!d.input && disabled ? 'true' : undefined"
    :aria-readonly="!d.input && isReadOnly ? 'true' : undefined"
    :aria-required="!d.input && required ? 'true' : undefined"
    :data-checked="checked || undefined"
    :data-disabled="disabled || undefined"
    :data-readonly="isReadOnly || undefined"
    :data-required="required || undefined"
    :data-state="checked ? 'checked' : 'unchecked'"
    :data-unchecked="!checked || undefined"
    :role="!d.input ? 'radio' : undefined"
    :tabindex="!d.input ? (disabled ? -1 : 0) : undefined"
    @click="handleRootClick"
    @contextmenu.capture.prevent
    @keydown="handleFallbackKeydown"
  >
    <input
      v-if="d.input"
      :id="inputId"
      class="pointer-events-none absolute inset-1 z-10 opacity-0"
      data-part="input"
      :checked="checked"
      :disabled="disabled || isReadOnly"
      :name="name"
      :readonly="isReadOnly"
      :required="required"
      type="checkbox"
      :value="d.value"
      @change="handleInputChange"
    />
    <Surface
      as="span"
      :class="thumbClass"
      :clickable="hoverable && !disabled && !isReadOnly"
      data-part="thumb"
      :hoverable="hoverable && !disabled && !isReadOnly"
      :outline="d.thumbOutline"
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
      :outline="d.thumbOutline"
      variant="gradient-fill"
      :wrap-content="false"
    />
    <span :class="indicatorClass" data-part="indicator" />
    <FocusRing v-if="focusable && !disabled && !isReadOnly" class="rounded-full" group="radio" />
  </component>
</template>
