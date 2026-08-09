<script setup lang="ts">
import { computed } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import FocusRing from "../feedback/FocusRing.vue";
import { cn } from "../../shared/cn.ts";
import Surface from "../surface/Surface.vue";
import {
  switchRootSizes,
  switchThumbOffsets,
  switchThumbSizes,
  type SwitchProps,
} from "./switch.contracts.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SwitchProps>(), {
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
  outline: undefined,
  readOnly: undefined,
  readonly: undefined,
  required: undefined,
  size: undefined,
  surfaceLevel: undefined,
  thumbOutline: undefined,
  thumbSurfaceLevel: undefined,
  thumbVariant: undefined,
  value: undefined,
  variant: undefined,
});

defineSlots<{
  icon?: (props: { checked: boolean }) => unknown;
}>();

const model = defineModel<boolean>({ default: false });
const emit = defineEmits<{
  change: [checked: boolean, event?: Event];
  "update:checked": [checked: boolean];
}>();
const ui = useUiContext();
const d = useComponentDefaults("Switch", props, {
  as: "label" as SwitchProps["as"],
  disabled: false,
  input: true,
  outline: true,
  required: false,
  size: "md" as SwitchProps["size"],
  surfaceLevel: "+1",
  thumbOutline: true,
  thumbSurfaceLevel: "+2",
  thumbVariant: "gradient" as SwitchProps["thumbVariant"],
  value: "on",
  variant: "solid" as SwitchProps["variant"],
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
  setChecked(!checked.value, event);
}

const rootClass = computed(() =>
  cn(
    "cui-switch group/cui-switch relative flex shrink-0 rounded-full select-none",
    switchRootSizes[d.value.size],
  ),
);

const thumbClass = computed(() =>
  cn(
    "z-10 rounded-full duration-300",
    switchThumbSizes[d.value.size],
    checked.value && switchThumbOffsets[d.value.size],
    checked.value ? "text-cui-on-primary" : "text-cui-fg-soft",
    d.value.disabled && "opacity-50",
  ),
);

const thumbFillClass = computed(() =>
  cn(
    "absolute inset-0 size-full shrink-0 rounded-full duration-200",
    !checked.value && "scale-0",
    checked.value ? "opacity-100" : "opacity-0",
  ),
);

const indicatorClass = computed(() =>
  cn(
    "absolute inset-0",
    d.value.size === "sm" && "scale-80",
    checked.value && `cui-color-${currentAccent.value}`,
  ),
);

const indicatorRotationClass = computed(() =>
  cn(
    "absolute inset-0 duration-300 group-active/cui-switch:scale-90",
    checked.value && "rotate-180",
    !checked.value && d.value.size === "sm" && "rotate-90",
  ),
);

const glyphLineBaseClass =
  "absolute top-1/2 left-1/2 -mt-px -ml-2 h-0.5 w-4 rounded-full duration-300";

const firstGlyphLineClass = computed(() =>
  cn(
    glyphLineBaseClass,
    "rotate-45",
    checked.value ? "bg-cui-on-primary" : "bg-cui-fg-soft",
    checked.value ? "translate-x-0.5 translate-y-[-1.75px] scale-x-40" : "scale-x-75",
  ),
);

const secondGlyphLineClass = computed(() =>
  cn(
    glyphLineBaseClass,
    "-rotate-45",
    checked.value ? "bg-cui-on-primary" : "bg-cui-fg-soft",
    checked.value ? "translate-x-[-1.5px] scale-x-60 -rotate-60" : "scale-x-75",
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
    :data-checked="checked || undefined"
    :data-disabled="d.disabled || undefined"
    :data-readonly="isReadOnly || undefined"
    :data-state="checked ? 'checked' : 'unchecked'"
    :data-unchecked="!checked || undefined"
    :role="!d.input ? 'switch' : undefined"
    :tabindex="!d.input ? (d.disabled ? -1 : 0) : undefined"
    @click="handleRootClick"
    @contextmenu.capture.prevent
    @keydown="handleFallbackKeydown"
  >
    <input
      v-if="d.input"
      :id="inputId"
      class="pointer-events-none absolute inset-0 z-10 opacity-0"
      data-part="input"
      :aria-checked="checked"
      :checked="checked"
      :disabled="d.disabled || isReadOnly"
      :name="d.name"
      :readonly="isReadOnly"
      :required="d.required"
      role="switch"
      type="checkbox"
      :value="d.value"
      @change="handleInputChange"
    />
    <Surface
      as="span"
      class="absolute inset-0 rounded-full"
      data-part="track"
      :level="d.surfaceLevel"
      :outline="d.outline"
      :variant="d.variant"
      :wrap-content="false"
    />
    <Surface
      as="span"
      :class="thumbClass"
      :clickable="!d.disabled && !isReadOnly"
      content-class-name="flex items-center justify-center"
      data-part="thumb"
      :hoverable="!d.disabled && !isReadOnly"
      :level="d.thumbSurfaceLevel"
      :outline="d.thumbOutline"
      :variant="d.thumbVariant"
    >
      <template #beforeContent>
        <Surface
          as="span"
          :class="thumbFillClass"
          :clickable="!d.disabled && !isReadOnly"
          :color="currentAccent"
          :hoverable="!d.disabled && !isReadOnly"
          level="+0"
          outline
          variant="gradient-fill"
        />
      </template>
      <slot name="icon" :checked="checked">
        <span :class="indicatorClass" aria-hidden="true" data-part="indicator">
          <span :class="indicatorRotationClass">
            <span :class="firstGlyphLineClass" />
            <span :class="secondGlyphLineClass" />
          </span>
        </span>
      </slot>
      <FocusRing
        v-if="focusable && !d.disabled && !isReadOnly"
        class="rounded-full"
        group="switch"
      />
    </Surface>
  </component>
</template>
