<script setup lang="ts">
import { computed } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import FocusRing from "../feedback/FocusRing.vue";
import { cn } from "../../shared/cn.ts";
import Surface from "../surface/Surface.vue";
import CheckboxGlyph from "./CheckboxGlyph.vue";
import {
  checkboxIndicatorSizes,
  checkboxRootSizes,
  type CheckboxProps,
} from "./checkbox.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CheckboxProps>(), {
  accent: undefined,
  as: undefined,
  checkClassName: undefined,
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
const ui = useUiContext();
const d = useComponentDefaults("Checkbox", props, {
  as: "label" as CheckboxProps["as"],
  disabled: false,
  input: true,
  required: false,
  size: "sm" as CheckboxProps["size"],
  thumbOutline: true,
});
const isReadOnly = computed(() => d.value.readOnly ?? d.value.readonly ?? false);
const checked = computed(() => d.value.checked ?? model.value);
const currentAccent = computed(() => d.value.color ?? d.value.accent ?? ui.accentColor.value);
const hoverable = computed(() => d.value.hoverable ?? d.value.as === "label");
const focusable = computed(() => d.value.focusable ?? (d.value.as === "label" || d.value.input));
const inputId = computed(() => d.value.inputId ?? d.value.id);

function setChecked(next: boolean, event?: Event): void {
  if (d.value.disabled || isReadOnly.value) return;

  model.value = next;
  emit("update:checked", next);
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
  if (d.value.input || d.value.disabled || isReadOnly.value) return;
  if (event.key !== " " && event.key !== "Enter") return;

  event.preventDefault();
  setChecked(!checked.value);
}

const rootClass = computed(() =>
  cn(
    "cui-checkbox group/cui-checkbox relative flex shrink-0 items-center justify-center rounded-full select-none",
    checkboxRootSizes[d.value.size],
    d.value.disabled && "opacity-50",
  ),
);

const thumbClass = "absolute inset-0 size-full shrink-0 rounded-full duration-200";

const checkedThumbClass = computed(() =>
  cn(thumbClass, !checked.value && "scale-0", checked.value ? "opacity-100" : "opacity-0"),
);

const indicatorClass = computed(() =>
  cn(
    "cui-checkbox__indicator pointer-events-none relative duration-200",
    checkboxIndicatorSizes[d.value.size],
    !checked.value && "scale-75 text-cui-fg-soft",
    checked.value && !d.value.disabled && !isReadOnly.value && "group-active/cui-checkbox:scale-90",
    !checked.value &&
      !d.value.disabled &&
      !isReadOnly.value &&
      "group-active/cui-checkbox:scale-65",
    checked.value && "text-cui-on-primary",
    checked.value && `cui-color-${currentAccent.value}`,
    d.value.checkClassName,
  ),
);
</script>

<template>
  <component
    :is="d.as"
    v-bind="$attrs"
    :class="rootClass"
    :aria-checked="!d.input ? checked : undefined"
    :aria-disabled="!d.input && d.disabled ? 'true' : undefined"
    :aria-readonly="!d.input && isReadOnly ? 'true' : undefined"
    :aria-required="!d.input && d.required ? 'true' : undefined"
    :data-checked="checked || undefined"
    :data-disabled="d.disabled || undefined"
    :data-readonly="isReadOnly || undefined"
    :data-required="d.required || undefined"
    :data-state="checked ? 'checked' : 'unchecked'"
    :data-unchecked="!checked || undefined"
    :role="!d.input ? 'checkbox' : undefined"
    :tabindex="!d.input ? (d.disabled ? -1 : 0) : undefined"
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
      :disabled="d.disabled || isReadOnly"
      :name="d.name"
      :readonly="isReadOnly"
      :required="d.required"
      type="checkbox"
      :value="d.value"
      @change="handleInputChange"
    />
    <Surface
      as="span"
      :class="thumbClass"
      data-part="thumb"
      :clickable="hoverable && !d.disabled && !isReadOnly"
      :hoverable="hoverable && !d.disabled && !isReadOnly"
      :outline="d.thumbOutline"
      variant="gradient"
      :wrap-content="false"
    />
    <Surface
      as="span"
      :color="currentAccent"
      :class="checkedThumbClass"
      data-part="thumb-checked"
      :clickable="hoverable && !d.disabled && !isReadOnly"
      :hoverable="hoverable && !d.disabled && !isReadOnly"
      :outline="d.thumbOutline"
      variant="gradient-fill"
      :wrap-content="false"
    />
    <CheckboxGlyph
      :class="indicatorClass"
      data-part="indicator"
      :data-state="checked ? 'checked' : 'unchecked'"
    />
    <FocusRing
      v-if="focusable && !d.disabled && !isReadOnly"
      class="rounded-full"
      group="checkbox"
    />
  </component>
</template>
