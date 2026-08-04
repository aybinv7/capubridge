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
import FocusRing from "../feedback/FocusRing.vue";
import Surface from "../surface/Surface.vue";
import SurfaceCut from "../surface/SurfaceCut.vue";
import type { ChoiceSize, SliderScale, SliderVariant } from "./form.contracts.ts";

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
const rootStyle = computed(
  () =>
    ({
      "--cui-slider-progress": String(progress.value),
      "--cui-slider-progress-percent": `${progress.value * 100}%`,
    }) as CSSProperties,
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

function handleKeydown(event: KeyboardEvent): void {
  const direction =
    event.key === "ArrowRight" || event.key === "ArrowUp"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? -1
        : 0;
  if (!direction) return;

  event.preventDefault();
  publish(value.value + props.step * direction, event);
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
    class="cui-slider"
    :class="[
      `cui-slider--${props.size}`,
      `cui-slider--${props.variant}`,
      props.rounded && 'cui-slider--rounded',
      dragging && 'cui-slider--dragging',
    ]"
    :data-disabled="props.disabled || undefined"
    :data-readonly="props.readOnly || undefined"
    :style="rootStyle"
    @contextmenu.capture.prevent
    @pointercancel="handlePointerUp"
    @pointerdown="handlePointerDown"
  >
    <template v-if="isTrack">
      <SurfaceCut
        as="span"
        class="cui-slider__track cui-slider__track--track"
        :wrap-content="false"
      />
      <Surface
        as="span"
        :color="effectiveColor"
        class="cui-slider__range cui-slider__range--track"
        :outline="props.rangeOutline"
        level="+2"
        :variant="props.rangeFill ? 'gradient-fill' : 'gradient'"
        :wrap-content="false"
      />
      <FocusRing
        v-if="!props.disabled && !props.readOnly"
        :offset="!props.tightFocusRing"
        rounded
      />
      <span class="cui-slider__handle" data-part="thumb" />
    </template>
    <template v-else>
      <SurfaceCut
        as="span"
        class="cui-slider__track cui-slider__track--thumb"
        :wrap-content="false"
      />
      <span class="cui-slider__range cui-slider__range--thumb">
        <span
          class="cui-slider__range-fill"
          :class="effectiveColor && `cui-accent-${effectiveColor}`"
        />
      </span>
      <span class="cui-slider__thumb-wrapper">
        <span class="cui-slider__value-anchor">
          <Surface
            as="span"
            :color="effectiveColor"
            class="cui-slider__value"
            content-class-name="cui-slider__value-content"
            outline
            variant="gradient"
          >
            <template v-if="!props.disabled && !props.readOnly" #beforeContent>
              <FocusRing :offset="!props.tightFocusRing" rounded />
            </template>
            {{ value }}
          </Surface>
        </span>
        <Surface
          as="span"
          :color="effectiveColor"
          class="cui-slider__thumb-surface"
          :outline="props.thumbOutline"
          variant="gradient-fill"
          :wrap-content="false"
        />
      </span>
    </template>
    <input
      v-bind="controlAttrs"
      class="cui-slider__input"
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
      @keydown="handleKeydown"
    />
  </div>
</template>
