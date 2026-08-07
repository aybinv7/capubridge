<script setup lang="ts">
import { computed, type Component } from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { SurfaceLevelInput, SurfaceVariant, UiAccent } from "../../foundations/contracts.ts";
import FocusRing from "../feedback/FocusRing.vue";
import { cn } from "../../shared/cn.ts";
import Surface from "../surface/Surface.vue";
import type { SwitchSize } from "./form.contracts.ts";
import { switchRootSizes, switchThumbOffsets, switchThumbSizes } from "./switch.contracts.ts";

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

const rootClass = computed(() =>
  cn(
    "cui-switch group/cui-switch relative flex shrink-0 rounded-full select-none",
    switchRootSizes[props.size],
  ),
);

const thumbClass = computed(() =>
  cn(
    "z-10 rounded-full duration-300",
    switchThumbSizes[props.size],
    checked.value && switchThumbOffsets[props.size],
    checked.value ? "text-cui-on-primary" : "text-cui-fg-soft",
    props.disabled && "opacity-50",
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
    props.size === "sm" && "scale-80",
    checked.value && `cui-accent-${currentAccent.value}`,
  ),
);

const indicatorRotationClass = computed(() =>
  cn(
    "absolute inset-0 duration-300 group-active/cui-switch:scale-90",
    checked.value && "rotate-180",
    !checked.value && props.size === "sm" && "rotate-90",
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
    :is="props.as"
    v-bind="$attrs"
    :class="rootClass"
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
    @contextmenu.capture.prevent
    @keydown="handleFallbackKeydown"
  >
    <input
      v-if="props.input"
      :id="inputId"
      class="pointer-events-none absolute inset-0 z-10 opacity-0"
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
      class="absolute inset-0 rounded-full"
      data-part="track"
      :level="props.surfaceLevel"
      :outline="props.outline"
      :variant="props.variant"
      :wrap-content="false"
    />
    <Surface
      as="span"
      :class="thumbClass"
      :clickable="!props.disabled && !isReadOnly"
      content-class-name="flex items-center justify-center"
      data-part="thumb"
      :hoverable="!props.disabled && !isReadOnly"
      :level="props.thumbSurfaceLevel"
      :outline="props.thumbOutline"
      :variant="props.thumbVariant"
    >
      <template #beforeContent>
        <Surface
          as="span"
          :class="thumbFillClass"
          :clickable="!props.disabled && !isReadOnly"
          :color="currentAccent"
          :hoverable="!props.disabled && !isReadOnly"
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
        v-if="focusable && !props.disabled && !isReadOnly"
        class="rounded-full"
        group="switch"
      />
    </Surface>
  </component>
</template>
