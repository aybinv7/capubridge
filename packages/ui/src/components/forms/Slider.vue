<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useAttrs,
  type CSSProperties,
} from "vue";

import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import { roundedClasses } from "../../shared/roundedClasses.ts";
import { rootSizeClasses } from "../../shared/sizeClasses.ts";
import FocusRing from "../feedback/FocusRing.vue";
import Surface from "../surface/Surface.vue";
import SurfaceCut from "../surface/SurfaceCut.vue";
import type { ChoiceSize, SliderScale, SliderVariant } from "./form.contracts.ts";
import {
  sliderRangeInsets,
  sliderRootHeights,
  sliderThumbSizes,
  sliderThumbSpacingVars,
  sliderTrackBarClasses,
  sliderValueOffsets,
} from "./slider.contracts.ts";

defineOptions({ inheritAttrs: false });

const sliderResolution = 1000;

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    color?: UiAccent;
    debounce?: number;
    defaultValue?: number;
    disabled?: boolean;
    input?: boolean;
    max?: number;
    min?: number;
    name?: string;
    rangeFill?: boolean;
    rangeOutline?: boolean;
    readOnly?: boolean;
    rounded?: boolean;
    scale?: SliderScale;
    size?: ChoiceSize;
    step?: number;
    throttle?: number;
    thumbOutline?: boolean;
    tightFocusRing?: boolean;
    value?: number;
    variant?: SliderVariant;
  }>(),
  {
    accent: undefined,
    color: undefined,
    debounce: 0,
    defaultValue: 0,
    disabled: false,
    input: false,
    max: 100,
    min: 0,
    name: undefined,
    rangeFill: false,
    rangeOutline: true,
    readOnly: false,
    rounded: false,
    scale: "linear",
    size: "sm",
    step: 1,
    throttle: 0,
    thumbOutline: true,
    tightFocusRing: false,
    value: undefined,
    variant: "thumb",
  },
);

const model = defineModel<number>();
const emit = defineEmits<{
  change: [value: number, event?: Event];
  "update:value": [value: number];
}>();
const ui = useUiContext();
const attrs = useAttrs();
const labellingAttributeNames = ["aria-label", "aria-labelledby", "aria-describedby"];
const controlAttrs = computed(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(([name]) => labellingAttributeNames.includes(name)),
  ),
);
const rootAttrs = computed(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(([name]) => !labellingAttributeNames.includes(name)),
  ),
);
const uncontrolledValue = shallowRef(props.defaultValue);
const dragging = ref(false);
let touched = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let throttleTimer: ReturnType<typeof setTimeout> | undefined;
let throttleLastFire = 0;
let throttlePending: number | undefined;

const isTrack = computed(() => props.variant === "track");
const isControlled = computed(() => props.value !== undefined);
const value = computed(() => props.value ?? model.value ?? uncontrolledValue.value);
const scaleFns = computed(() => {
  if (props.scale === "linear") return undefined;
  if (props.scale === "log") {
    if (props.min <= 0 || props.max <= props.min) return undefined;
    return {
      fromSlider: (position: number) => props.min * (props.max / props.min) ** position,
      toSlider: (next: number) => Math.log(next / props.min) / Math.log(props.max / props.min),
    };
  }
  return props.scale;
});
const progress = computed(() => {
  const span = props.max - props.min;
  if (span <= 0) return 0;
  const next = Math.min(props.max, Math.max(props.min, value.value));
  const position = scaleFns.value ? scaleFns.value.toSlider(next) : (next - props.min) / span;
  return Math.min(1, Math.max(0, position));
});
const effectiveColor = computed(
  () => props.color ?? props.accent ?? (isTrack.value ? undefined : ui.accent.value),
);
const inputValue = computed(() =>
  scaleFns.value ? Math.round(progress.value * sliderResolution) : value.value,
);
const inputMin = computed(() => (scaleFns.value ? 0 : props.min));
const inputMax = computed(() => (scaleFns.value ? sliderResolution : props.max));
const inputStep = computed(() => (scaleFns.value ? 1 : props.step));
const radii = computed(() => roundedClasses(props.size, props.rounded, false));
const durationClass = computed(() => (dragging.value ? "duration-0" : "duration-300"));
const thumbSpacing = computed(() => sliderThumbSpacingVars[props.size]);

const rootClass = computed(() =>
  cn(
    "cui-slider group/cui-slider relative flex touch-pan-y select-none",
    !isTrack.value && sliderRootHeights[props.size],
    isTrack.value && rootSizeClasses(props.size, "height"),
  ),
);

const trackVariantTrackClass = computed(() =>
  cn("pointer-events-none absolute inset-0", radii.value.itemRoundedClasses),
);

const trackVariantRangeClass = computed(() =>
  cn(
    effectiveColor.value && `cui-accent-${effectiveColor.value}`,
    "pointer-events-none absolute top-0 bottom-0 left-0 ease-out",
    props.rounded && "rounded-l-full",
    radii.value.itemRoundedClasses,
    props.disabled && "opacity-50",
    durationClass.value,
  ),
);

const trackVariantRangeStyle = computed(
  () => ({ width: `calc((100% - 0px) * ${progress.value})` }) as CSSProperties,
);

const trackVariantFocusRingClass = computed(() =>
  props.tightFocusRing ? radii.value.itemRoundedClasses : radii.value.focusRoundedClasses,
);

const trackVariantHandleClass = computed(() =>
  cn(
    effectiveColor.value && `cui-accent-${effectiveColor.value}`,
    "pointer-events-none absolute top-1/2 h-4 w-0.5 shrink-0 -translate-y-1/2 scale-y-75 rounded-full bg-cui-fg-softer ease-out group-focus-within/cui-slider:scale-100 group-focus-within/cui-slider:bg-cui-primary",
    props.rangeFill &&
      progress.value > 0.5 &&
      "bg-cui-on-primary outline-transparent group-focus-within/cui-slider:bg-cui-on-primary",
    props.disabled && "opacity-50",
    durationClass.value,
  ),
);

const trackVariantHandleStyle = computed(
  () => ({ left: `calc(8px + (100% - 18px) * ${progress.value})` }) as CSSProperties,
);

const thumbVariantTrackClass = computed(() =>
  cn(
    "pointer-events-none absolute inset-0 top-1/2 right-0 left-0 rounded-full",
    sliderTrackBarClasses[props.size],
  ),
);

const thumbVariantRangeClass = computed(() =>
  cn("absolute top-1/2 -mt-px h-0.5 overflow-hidden rounded-full", sliderRangeInsets[props.size]),
);

const thumbVariantRangeFillClass = computed(() =>
  cn(
    `cui-accent-${effectiveColor.value}`,
    "absolute inset-0 rounded-full bg-cui-primary ease-out",
    !props.disabled &&
      !props.readOnly &&
      "group-focus-within/slider:-translate-x-3 group-active/slider:-translate-x-3",
    props.disabled && "opacity-50",
    durationClass.value,
  ),
);

const thumbVariantRangeFillStyle = computed(
  () => ({ width: `calc((100% - ${thumbSpacing.value}) * ${progress.value})` }) as CSSProperties,
);

const thumbWrapperClass = computed(() =>
  cn(
    "pointer-events-none absolute inset-0 flex items-center ease-out group-focus-within/cui-slider:z-10",
    durationClass.value,
  ),
);

const thumbWrapperStyle = computed(
  () =>
    ({
      paddingLeft: `calc((100% - ${thumbSpacing.value}) * ${progress.value})`,
    }) as CSSProperties,
);

const valueBubbleClass = computed(() =>
  cn(
    sliderValueOffsets[props.size],
    "absolute -bottom-4 min-w-8 -translate-x-1/2 scale-0 rounded-cui-2xl px-1 pt-2.5 pb-8 text-center text-cui-xs leading-none font-medium text-cui-primary duration-300",
    !props.disabled &&
      !props.readOnly &&
      "group-focus-within/cui-slider:scale-100 group-active/cui-slider:scale-100",
  ),
);

const thumbSurfaceClass = computed(() =>
  cn("z-10 shrink-0 rounded-full", sliderThumbSizes[props.size]),
);

function normalize(next: number): number {
  const rounded = props.step > 0 ? Math.round(next / props.step) * props.step : next;
  return Math.min(props.max, Math.max(props.min, rounded));
}

function publish(next: number, event?: Event): void {
  if (props.disabled || props.readOnly) return;

  const normalized = normalize(next);
  if (!isControlled.value) uncontrolledValue.value = normalized;
  model.value = normalized;
  emit("update:value", normalized);

  if (props.throttle > 0) {
    const now = Date.now();
    const elapsed = now - throttleLastFire;
    if (elapsed >= props.throttle) {
      throttleLastFire = now;
      throttlePending = undefined;
      if (throttleTimer) clearTimeout(throttleTimer);
      throttleTimer = undefined;
      emit("change", normalized, event);
      return;
    }

    throttlePending = normalized;
    if (!throttleTimer) {
      throttleTimer = setTimeout(() => {
        throttleTimer = undefined;
        if (throttlePending === undefined) return;
        throttleLastFire = Date.now();
        emit("change", throttlePending);
        throttlePending = undefined;
      }, props.throttle - elapsed);
    }
    return;
  }

  if (props.debounce > 0) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => emit("change", normalized), props.debounce);
    return;
  }

  emit("change", normalized, event);
}

function handleInput(event: Event): void {
  const raw = Number((event.target as HTMLInputElement).value);
  publish(scaleFns.value ? scaleFns.value.fromSlider(raw / sliderResolution) : raw, event);
}

function handlePointerDown(): void {
  touched = true;
}

function handlePointerMove(): void {
  if (touched) dragging.value = true;
}

function handlePointerUp(): void {
  touched = false;
  dragging.value = false;
}

onMounted(() => {
  document.addEventListener("pointermove", handlePointerMove);
  document.addEventListener("pointerup", handlePointerUp);
});

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (throttleTimer) clearTimeout(throttleTimer);
  document.removeEventListener("pointermove", handlePointerMove);
  document.removeEventListener("pointerup", handlePointerUp);
});
</script>

<template>
  <div
    v-bind="rootAttrs"
    :class="rootClass"
    :data-disabled="props.disabled || undefined"
    :data-readonly="props.readOnly || undefined"
    @contextmenu.capture.prevent
    @pointercancel="handlePointerUp"
    @pointerdown="handlePointerDown"
  >
    <template v-if="isTrack">
      <SurfaceCut
        as="span"
        :class="trackVariantTrackClass"
        data-part="track"
        :wrap-content="false"
      />
      <Surface
        as="span"
        :class="trackVariantRangeClass"
        :color="effectiveColor"
        data-part="range"
        level="+2"
        :outline="props.rangeOutline"
        :style="trackVariantRangeStyle"
        :variant="props.rangeFill ? 'gradient-fill' : 'gradient'"
        :wrap-content="false"
      />
      <FocusRing
        v-if="!props.disabled && !props.readOnly"
        :class="trackVariantFocusRingClass"
        group="slider"
        :offset="!props.tightFocusRing"
      />
      <span :class="trackVariantHandleClass" data-part="thumb" :style="trackVariantHandleStyle" />
    </template>
    <template v-else>
      <SurfaceCut as="span" :class="thumbVariantTrackClass" data-part="track" />
      <span :class="thumbVariantRangeClass" data-part="range">
        <span :class="thumbVariantRangeFillClass" :style="thumbVariantRangeFillStyle" />
      </span>
      <span :class="thumbWrapperClass" data-part="thumb-wrapper" :style="thumbWrapperStyle">
        <span class="relative top-0 size-0 h-0" data-part="value">
          <Surface
            as="span"
            :class="valueBubbleClass"
            :color="effectiveColor"
            outline
            variant="gradient"
          >
            <template v-if="!props.disabled && !props.readOnly" #beforeContent>
              <FocusRing class="rounded-full" group="slider" :offset="!props.tightFocusRing" />
            </template>
            {{ value }}
          </Surface>
        </span>
        <Surface
          as="span"
          :class="thumbSurfaceClass"
          :color="effectiveColor"
          data-part="thumb"
          :outline="props.thumbOutline"
          variant="gradient-fill"
          :wrap-content="false"
        />
      </span>
    </template>
    <input
      v-bind="controlAttrs"
      class="relative m-0 block w-full appearance-none border-transparent bg-transparent p-0 focus:outline-none"
      data-part="input"
      :disabled="props.disabled || props.readOnly"
      :max="inputMax"
      :min="inputMin"
      :name="props.name"
      :readonly="props.readOnly"
      :step="inputStep"
      type="range"
      :value="inputValue"
      @input="handleInput"
    />
  </div>
</template>
