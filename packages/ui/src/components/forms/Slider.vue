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

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import { cn } from "../../shared/cn.ts";
import { roundedClasses } from "../../shared/roundedClasses.ts";
import { rootSizeClasses } from "../../shared/sizeClasses.ts";
import FocusRing from "../feedback/FocusRing.vue";
import Surface from "../surface/Surface.vue";
import SurfaceCut from "../surface/SurfaceCut.vue";
import {
  sliderRangeInsets,
  sliderRootHeights,
  sliderThumbSizes,
  sliderThumbSpacingVars,
  sliderTrackBarClasses,
  sliderValueOffsets,
  type SliderProps,
} from "./slider.contracts.ts";

defineOptions({ inheritAttrs: false });

const sliderResolution = 1000;

const props = withDefaults(defineProps<SliderProps>(), {
  accent: undefined,
  color: undefined,
  debounce: undefined,
  defaultValue: undefined,
  disabled: undefined,
  input: undefined,
  max: undefined,
  min: undefined,
  name: undefined,
  rangeFill: undefined,
  rangeOutline: undefined,
  readOnly: undefined,
  rounded: undefined,
  scale: undefined,
  size: undefined,
  step: undefined,
  throttle: undefined,
  thumbOutline: undefined,
  tightFocusRing: undefined,
  value: undefined,
  variant: undefined,
});

const model = defineModel<number>();
const emit = defineEmits<{
  change: [value: number, event?: Event];
  "update:value": [value: number];
}>();
const ui = useUiContext();
const attrs = useAttrs();
const d = useComponentDefaults("Slider", props, {
  debounce: 0,
  defaultValue: 0,
  disabled: false,
  input: false,
  max: 100,
  min: 0,
  rangeFill: false,
  rangeOutline: true,
  readOnly: false,
  rounded: false,
  scale: "linear" as SliderProps["scale"],
  size: "sm" as SliderProps["size"],
  step: 1,
  throttle: 0,
  thumbOutline: true,
  tightFocusRing: false,
  variant: "thumb" as SliderProps["variant"],
});
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
const uncontrolledValue = shallowRef(d.value.defaultValue);
const dragging = ref(false);
let touched = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let throttleTimer: ReturnType<typeof setTimeout> | undefined;
let throttleLastFire = 0;
let throttlePending: number | undefined;

const isTrack = computed(() => d.value.variant === "track");
const isControlled = computed(() => d.value.value !== undefined);
const value = computed(() => d.value.value ?? model.value ?? uncontrolledValue.value);
const scaleFns = computed(() => {
  if (d.value.scale === "linear") return undefined;
  if (d.value.scale === "log") {
    if (d.value.min <= 0 || d.value.max <= d.value.min) return undefined;
    return {
      fromSlider: (position: number) => d.value.min * (d.value.max / d.value.min) ** position,
      toSlider: (next: number) =>
        Math.log(next / d.value.min) / Math.log(d.value.max / d.value.min),
    };
  }
  return d.value.scale;
});
const progress = computed(() => {
  const span = d.value.max - d.value.min;
  if (span <= 0) return 0;
  const next = Math.min(d.value.max, Math.max(d.value.min, value.value));
  const position = scaleFns.value ? scaleFns.value.toSlider(next) : (next - d.value.min) / span;
  return Math.min(1, Math.max(0, position));
});
const effectiveColor = computed(
  () => d.value.color ?? d.value.accent ?? (isTrack.value ? undefined : ui.accentColor.value),
);
const inputValue = computed(() =>
  scaleFns.value ? Math.round(progress.value * sliderResolution) : value.value,
);
const inputMin = computed(() => (scaleFns.value ? 0 : d.value.min));
const inputMax = computed(() => (scaleFns.value ? sliderResolution : d.value.max));
const inputStep = computed(() => (scaleFns.value ? 1 : d.value.step));
const radii = computed(() => roundedClasses(d.value.size, d.value.rounded, false));
const durationClass = computed(() => (dragging.value ? "duration-0" : "duration-300"));
const thumbSpacing = computed(() => sliderThumbSpacingVars[d.value.size]);

const rootClass = computed(() =>
  cn(
    "cui-slider group/cui-slider relative flex touch-pan-y select-none",
    !isTrack.value && sliderRootHeights[d.value.size],
    isTrack.value && rootSizeClasses(d.value.size, "height"),
  ),
);

const trackVariantTrackClass = computed(() =>
  cn("pointer-events-none absolute inset-0", radii.value.itemRoundedClasses),
);

const trackVariantRangeClass = computed(() =>
  cn(
    effectiveColor.value && `cui-color-${effectiveColor.value}`,
    "pointer-events-none absolute top-0 bottom-0 left-0 ease-out",
    d.value.rounded && "rounded-l-full",
    radii.value.itemRoundedClasses,
    d.value.disabled && "opacity-50",
    durationClass.value,
  ),
);

const trackVariantRangeStyle = computed(
  () => ({ width: `calc((100% - 0px) * ${progress.value})` }) as CSSProperties,
);

const trackVariantFocusRingClass = computed(() =>
  d.value.tightFocusRing ? radii.value.itemRoundedClasses : radii.value.focusRoundedClasses,
);

const trackVariantHandleClass = computed(() =>
  cn(
    effectiveColor.value && `cui-color-${effectiveColor.value}`,
    "pointer-events-none absolute top-1/2 h-4 w-0.5 shrink-0 -translate-y-1/2 scale-y-75 rounded-full bg-cui-fg-softer ease-out group-focus-within/cui-slider:scale-100 group-focus-within/cui-slider:bg-cui-primary",
    d.value.rangeFill &&
      progress.value > 0.5 &&
      "bg-cui-on-primary outline-transparent group-focus-within/cui-slider:bg-cui-on-primary",
    d.value.disabled && "opacity-50",
    durationClass.value,
  ),
);

const trackVariantHandleStyle = computed(
  () => ({ left: `calc(8px + (100% - 18px) * ${progress.value})` }) as CSSProperties,
);

const thumbVariantTrackClass = computed(() =>
  cn(
    "pointer-events-none absolute inset-0 top-1/2 right-0 left-0 rounded-full",
    sliderTrackBarClasses[d.value.size],
  ),
);

const thumbVariantRangeClass = computed(() =>
  cn("absolute top-1/2 -mt-px h-0.5 overflow-hidden rounded-full", sliderRangeInsets[d.value.size]),
);

const thumbVariantRangeFillClass = computed(() =>
  cn(
    `cui-color-${effectiveColor.value}`,
    "absolute inset-0 rounded-full bg-cui-primary ease-out",
    !d.value.disabled &&
      !d.value.readOnly &&
      "group-focus-within/slider:-translate-x-3 group-active/slider:-translate-x-3",
    d.value.disabled && "opacity-50",
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
    sliderValueOffsets[d.value.size],
    "absolute -bottom-4 min-w-8 -translate-x-1/2 scale-0 rounded-cui-2xl px-1 pt-2.5 pb-8 text-center text-cui-xs leading-none font-medium text-cui-primary duration-300",
    !d.value.disabled &&
      !d.value.readOnly &&
      "group-focus-within/cui-slider:scale-100 group-active/cui-slider:scale-100",
  ),
);

const thumbSurfaceClass = computed(() =>
  cn("z-10 shrink-0 rounded-full", sliderThumbSizes[d.value.size]),
);

function normalize(next: number): number {
  const rounded = d.value.step > 0 ? Math.round(next / d.value.step) * d.value.step : next;
  return Math.min(d.value.max, Math.max(d.value.min, rounded));
}

function publish(next: number, event?: Event): void {
  if (d.value.disabled || d.value.readOnly) return;

  const normalized = normalize(next);
  if (!isControlled.value) uncontrolledValue.value = normalized;
  model.value = normalized;
  emit("update:value", normalized);

  if (d.value.throttle > 0) {
    const now = Date.now();
    const elapsed = now - throttleLastFire;
    if (elapsed >= d.value.throttle) {
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
      }, d.value.throttle - elapsed);
    }
    return;
  }

  if (d.value.debounce > 0) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => emit("change", normalized), d.value.debounce);
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
    :data-disabled="d.disabled || undefined"
    :data-readonly="d.readOnly || undefined"
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
        :outline="d.rangeOutline"
        :style="trackVariantRangeStyle"
        :variant="d.rangeFill ? 'gradient-fill' : 'gradient'"
        :wrap-content="false"
      />
      <FocusRing
        v-if="!d.disabled && !d.readOnly"
        :class="trackVariantFocusRingClass"
        group="slider"
        :offset="!d.tightFocusRing"
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
            <template v-if="!d.disabled && !d.readOnly" #beforeContent>
              <FocusRing class="rounded-full" group="slider" :offset="!d.tightFocusRing" />
            </template>
            {{ value }}
          </Surface>
        </span>
        <Surface
          as="span"
          :class="thumbSurfaceClass"
          :color="effectiveColor"
          data-part="thumb"
          :outline="d.thumbOutline"
          variant="gradient-fill"
          :wrap-content="false"
        />
      </span>
    </template>
    <input
      v-bind="controlAttrs"
      class="relative m-0 block w-full appearance-none border-transparent bg-transparent p-0 focus:outline-none"
      data-part="input"
      :disabled="d.disabled || d.readOnly"
      :max="inputMax"
      :min="inputMin"
      :name="d.name"
      :readonly="d.readOnly"
      :step="inputStep"
      type="range"
      :value="inputValue"
      @input="handleInput"
    />
  </div>
</template>
