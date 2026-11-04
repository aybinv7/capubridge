<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useAttrs, watch } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import {
  buildColorValue,
  CHECKER,
  colorSignature,
  gradientCss,
  gradientPreviewCss,
  hslToHsv,
  hsvToHsl,
  hsvToRgb,
  isGradientInput,
  parseColor,
  parseGradient,
  rgbToHsv,
  type ColorInput,
  type GradientInput,
  type GradientStop,
  type Hsva,
} from '../shared/color.ts';
import Button from './Button.vue';
import {
  colorEditorAreaHeight,
  colorEditorBarHeight,
  colorEditorHueTrack,
  colorEditorSwatch,
  colorEditorThumb,
  colorEditorThumbClass,
  colorEditorThumbPx,
  colorEditorToolbarSizes,
  type ColorEditorControlSize,
  type ColorEditorEmitValue,
  type ColorEditorFormat,
  type ColorEditorInternal,
  type ColorEditorMode,
  type ColorEditorProps,
} from './colorEditor.contracts.ts';
import ArrowLeftIcon from './icons/ArrowLeftIcon.vue';
import FlipIcon from './icons/FlipIcon.vue';
import GradientColorIcon from './icons/GradientColorIcon.vue';
import SolidColorIcon from './icons/SolidColorIcon.vue';
import Input from './Input.vue';
import NumberScrubber from './NumberScrubber.vue';
import Segmented from './Segmented.vue';
import SegmentedButton from './SegmentedButton.vue';
import Toolbar from './Toolbar.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ColorEditorProps>(), {
  alpha: undefined,
  angleControl: undefined,
  areaClassName: undefined,
  controlOutline: undefined,
  controlSize: undefined,
  debounce: undefined,
  defaultValue: undefined,
  disabled: undefined,
  format: undefined,
  gradient: undefined,
  hexInput: undefined,
  inputs: undefined,
  readOnly: undefined,
  swatches: undefined,
  throttle: undefined,
});

/** Controlled value. A CSS color string, a channel set, or a gradient object. */
const model = defineModel<ColorInput | GradientInput | undefined>({
  default: undefined,
});

const emit = defineEmits<{
  /** Fires on every change with the full color, or a discriminated `solid` / `linear` value in gradient mode. */
  change: [value: ColorEditorEmitValue];
}>();

const d = useComponentDefaults('ColorEditor', props, {
  alpha: true,
  angleControl: 'scrubber' as 'button' | 'scrubber',
  controlOutline: true,
  controlSize: 'md' as ColorEditorControlSize,
  debounce: 0,
  disabled: false,
  format: 'rgb' as ColorEditorFormat,
  gradient: false,
  hexInput: true,
  inputs: true,
  readOnly: false,
  throttle: 0,
});

const slots = defineSlots<{
  /** Content rendered below the panel, after the swatches. Stays interactive when `disabled`. */
  footer?: () => unknown;
  /** Content rendered above the panel, before the controls. Stays interactive when `disabled`. */
  header?: () => unknown;
}>();

const attrs = useAttrs();
const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

const interactive = computed(() => !d.value.disabled && !d.value.readOnly);
const toolbarSize = computed(
  () => colorEditorToolbarSizes[d.value.controlSize],
);

// The alpha % scrubber rides along with the hex input — show it only when
// alpha, the input row, and the hex input are all on. On its own the alpha
// *slider* already covers transparency, so a lone scrubber adds nothing.
const alphaInput = computed(
  () => d.value.alpha && d.value.inputs && d.value.hexInput,
);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrap360(value: number): number {
  return ((value % 360) + 360) % 360;
}

function r0(value: number): number {
  return Math.round(value);
}

/** Center-position a thumb so it never overshoots the track ends. */
function thumbLeft(fraction: number): string {
  return `calc(${fraction} * (100% - ${colorEditorThumbPx}px) + ${colorEditorThumbPx / 2}px)`;
}

function cloneInternal(source: ColorEditorInternal): ColorEditorInternal {
  return {
    mode: source.mode,
    solid: { ...source.solid },
    angle: source.angle,
    stops: [
      { hsva: { ...source.stops[0].hsva }, position: source.stops[0].position },
      { hsva: { ...source.stops[1].hsva }, position: source.stops[1].position },
    ],
    active: source.active,
  };
}

function currentOf(source: ColorEditorInternal): Hsva {
  return source.mode === 'linear'
    ? source.stops[source.active].hsva
    : source.solid;
}

function sortedStops(source: ColorEditorInternal): GradientStop[] {
  return source.stops
    .map((stop) => ({
      color: buildColorValue(stop.hsva),
      position: stop.position,
    }))
    .sort((a, b) => a.position - b.position);
}

function isValidHex(text: string): boolean {
  return /^[0-9a-f]{3,8}$/iu.test(text) && [3, 4, 6, 8].includes(text.length);
}

function seedFrom(
  input: ColorInput | GradientInput | undefined,
): ColorEditorInternal {
  if (d.value.gradient && isGradientInput(input)) {
    const parsed = parseGradient(input);
    const list = parsed?.stops ?? [];
    const first = list[0] ?? { hsva: { h: 0, s: 0, v: 0, a: 1 }, position: 0 };
    const last = list[list.length - 1] ?? {
      hsva: { h: 0, s: 0, v: 100, a: 1 },
      position: 100,
    };

    return {
      mode: 'linear',
      solid: { ...first.hsva },
      angle: parsed?.angle ?? 90,
      stops: [
        { hsva: { ...first.hsva }, position: first.position },
        { hsva: { ...last.hsva }, position: last.position },
      ],
      active: 0,
    };
  }

  const hsva = parseColor(input as ColorInput | undefined);
  return {
    mode: 'solid',
    solid: hsva,
    angle: 90,
    stops: [
      { hsva: { ...hsva }, position: 0 },
      { hsva: { ...hsva, a: 0 }, position: 100 },
    ],
    active: 0,
  };
}

function buildOutput(source: ColorEditorInternal): ColorEditorEmitValue {
  if (!d.value.gradient) return buildColorValue(source.solid);
  if (source.mode === 'solid') {
    return { type: 'solid', ...buildColorValue(source.solid) };
  }

  const stops = sortedStops(source);
  return {
    type: 'linear',
    angle: source.angle,
    stops,
    css: gradientCss(source.angle, stops),
  };
}

function signatureOf(source: ColorEditorInternal): string {
  if (!d.value.gradient) return colorSignature(source.solid);
  if (source.mode === 'solid') return `solid|${colorSignature(source.solid)}`;
  return `linear|${source.angle}|${sortedStops(source)
    .map((stop) => `${stop.position}:${stop.color.hex}`)
    .join('|')}`;
}

const internal = ref<ColorEditorInternal>(
  seedFrom(model.value ?? d.value.defaultValue),
);
let lastSignature = signatureOf(internal.value);
let interacting = false;

// Rate-limit only the outward `change`; internal state always updates
// immediately so the panel stays responsive. Mirrors Slider's debounce /
// throttle semantics. The trailing call guarantees the final value is emitted.
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let throttleTimer: ReturnType<typeof setTimeout> | undefined;
let throttleLastFire = 0;
let throttlePending: ColorEditorEmitValue | undefined;

function emitChange(out: ColorEditorEmitValue): void {
  if (d.value.throttle > 0) {
    const now = Date.now();
    const elapsed = now - throttleLastFire;

    if (elapsed >= d.value.throttle) {
      throttleLastFire = now;
      throttlePending = undefined;
      if (throttleTimer) {
        clearTimeout(throttleTimer);
        throttleTimer = undefined;
      }
      emit('change', out);
      return;
    }

    throttlePending = out;
    throttleTimer ??= setTimeout(() => {
      throttleTimer = undefined;
      if (throttlePending === undefined) return;
      const pending = throttlePending;
      throttlePending = undefined;
      throttleLastFire = Date.now();
      emit('change', pending);
    }, d.value.throttle - elapsed);
    return;
  }

  if (d.value.debounce > 0) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => emit('change', out), d.value.debounce);
    return;
  }

  emit('change', out);
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (throttleTimer) clearTimeout(throttleTimer);
});

// Sync external (controlled) value changes. Skipped while the user is
// interacting — mid-drag the component is the source of truth, and our own
// rapid change echoes would otherwise race back in and clobber state.
// The signature guard ignores the (non-interacting) echo of what we emitted;
// `active` is UI-only, so it's always preserved across a reseed.
watch(model, (next) => {
  if (next === undefined || interacting) return;
  const seeded = seedFrom(next);
  const signature = signatureOf(seeded);
  if (signature === lastSignature) return;

  seeded.active = internal.value.active;
  lastSignature = signature;
  internal.value = seeded;
});

function patch(
  mutate: (draft: ColorEditorInternal) => void,
  doEmit = true,
): void {
  const next = cloneInternal(internal.value);
  mutate(next);
  internal.value = next;

  if (!doEmit) return;
  lastSignature = signatureOf(next);
  const out = buildOutput(next);
  // `v-model` carries the CSS string, which is a valid `ColorInput`; `change`
  // carries upstream's full structured value. The signature was recorded first,
  // so the watch above ignores this echo instead of reseeding mid-interaction.
  model.value = out.css;
  emitChange(out);
}

const cur = computed(() => currentOf(internal.value));
const opaque = computed(() => buildColorValue({ ...cur.value, a: 1 }).hex);
const curValue = computed(() => buildColorValue(cur.value));
const rgb = computed(() => curValue.value.rgb);
const hsl = computed(() => curValue.value.hsl);

const areaElement = ref<HTMLDivElement>();
const hueElement = ref<HTMLDivElement>();
const alphaElement = ref<HTMLDivElement>();
const gradientBar = ref<HTMLDivElement>();

function drag(
  element: HTMLElement | undefined,
  event: PointerEvent,
  onPos: (x: number, y: number) => void,
  padX = 0,
): void {
  if (!interactive.value || !element || event.button !== 0) return;
  interacting = true;

  const rect = element.getBoundingClientRect();
  const travel = rect.width - 2 * padX;

  const apply = (clientX: number, clientY: number): void => {
    onPos(
      clamp((clientX - rect.left - padX) / travel, 0, 1),
      clamp((clientY - rect.top) / rect.height, 0, 1),
    );
  };

  apply(event.clientX, event.clientY);

  const onMove = (moveEvent: PointerEvent): void => {
    moveEvent.preventDefault();
    apply(moveEvent.clientX, moveEvent.clientY);
  };

  const onUp = (): void => {
    interacting = false;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function onAreaDown(event: PointerEvent): void {
  drag(areaElement.value, event, (x, y) =>
    patch((draft) => {
      const channel = currentOf(draft);
      channel.s = x * 100;
      channel.v = (1 - y) * 100;
    }),
  );
}

function onHueDown(event: PointerEvent): void {
  drag(
    hueElement.value,
    event,
    (x) =>
      patch((draft) => {
        currentOf(draft).h = x * 360;
      }),
    colorEditorThumbPx / 2,
  );
}

function onAlphaDown(event: PointerEvent): void {
  drag(
    alphaElement.value,
    event,
    (x) =>
      patch((draft) => {
        currentOf(draft).a = Math.round(x * 100) / 100;
      }),
    colorEditorThumbPx / 2,
  );
}

function kstep(event: KeyboardEvent): number {
  return event.shiftKey ? 10 : 1;
}

function onAreaKey(event: KeyboardEvent): void {
  if (!interactive.value) return;
  const step = kstep(event);
  const current = cur.value;

  const moves: Record<string, () => void> = {
    ArrowLeft: () =>
      patch((draft) => (currentOf(draft).s = clamp(current.s - step, 0, 100))),
    ArrowRight: () =>
      patch((draft) => (currentOf(draft).s = clamp(current.s + step, 0, 100))),
    ArrowUp: () =>
      patch((draft) => (currentOf(draft).v = clamp(current.v + step, 0, 100))),
    ArrowDown: () =>
      patch((draft) => (currentOf(draft).v = clamp(current.v - step, 0, 100))),
  };

  const move = moves[event.key];
  if (!move) return;
  event.preventDefault();
  move();
}

function onHueKey(event: KeyboardEvent): void {
  if (!interactive.value) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

  const step = kstep(event);
  event.preventDefault();
  patch(
    (draft) =>
      (currentOf(draft).h = wrap360(
        cur.value.h + (event.key === 'ArrowRight' ? step : -step),
      )),
  );
}

function onAlphaKey(event: KeyboardEvent): void {
  if (!interactive.value) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

  const step = (event.shiftKey ? 10 : 1) / 100;
  event.preventDefault();
  patch(
    (draft) =>
      (currentOf(draft).a = clamp(
        Math.round(
          (cur.value.a + (event.key === 'ArrowRight' ? step : -step)) * 100,
        ) / 100,
        0,
        1,
      )),
  );
}

function setRgb(key: 'b' | 'g' | 'r', value: number): void {
  patch((draft) => {
    const channel = currentOf(draft);
    const next = { ...hsvToRgb(channel) };
    next[key] = clamp(r0(value), 0, 255);
    const converted = rgbToHsv(next);
    if (converted.s !== 0) channel.h = converted.h;
    if (converted.v !== 0) channel.s = converted.s;
    channel.v = converted.v;
  });
}

function setHsl(key: 'h' | 'l' | 's', value: number): void {
  patch((draft) => {
    const channel = currentOf(draft);
    const next = hsvToHsl(channel);
    next[key] = key === 'h' ? wrap360(value) : clamp(value, 0, 100);
    const converted = hslToHsv(next.h, next.s, next.l, channel.a);
    channel.h = next.h;
    channel.s = converted.s;
    channel.v = converted.v;
  });
}

function setHsb(key: 'b' | 'h' | 's', value: number): void {
  patch((draft) => {
    const channel = currentOf(draft);
    if (key === 'h') channel.h = wrap360(value);
    else if (key === 's') channel.s = clamp(value, 0, 100);
    else channel.v = clamp(value, 0, 100);
  });
}

interface ChannelDef {
  label: string;
  max: number;
  min: number;
  set: (value: number) => void;
  value: number;
}

const channels = computed<ChannelDef[]>(() => {
  if (d.value.format === 'rgb') {
    return [
      {
        label: 'R',
        value: rgb.value.r,
        min: 0,
        max: 255,
        set: (v) => setRgb('r', v),
      },
      {
        label: 'G',
        value: rgb.value.g,
        min: 0,
        max: 255,
        set: (v) => setRgb('g', v),
      },
      {
        label: 'B',
        value: rgb.value.b,
        min: 0,
        max: 255,
        set: (v) => setRgb('b', v),
      },
    ];
  }

  if (d.value.format === 'hsl') {
    return [
      {
        label: 'H',
        value: r0(hsl.value.h),
        min: 0,
        max: 360,
        set: (v) => setHsl('h', v),
      },
      {
        label: 'S',
        value: r0(hsl.value.s),
        min: 0,
        max: 100,
        set: (v) => setHsl('s', v),
      },
      {
        label: 'L',
        value: r0(hsl.value.l),
        min: 0,
        max: 100,
        set: (v) => setHsl('l', v),
      },
    ];
  }

  return [
    {
      label: 'H',
      value: r0(cur.value.h),
      min: 0,
      max: 360,
      set: (v) => setHsb('h', v),
    },
    {
      label: 'S',
      value: r0(cur.value.s),
      min: 0,
      max: 100,
      set: (v) => setHsb('s', v),
    },
    {
      label: 'B',
      value: r0(cur.value.v),
      min: 0,
      max: 100,
      set: (v) => setHsb('b', v),
    },
  ];
});

const hex6 = computed(() =>
  buildColorValue({ ...cur.value, a: 1 })
    .hex.slice(1)
    .toUpperCase(),
);
const hexText = ref(hex6.value);
const hexFocused = ref(false);

watch([hex6, hexFocused], ([next, focused]) => {
  if (!focused) hexText.value = next;
});

function onHexInput(value: string): void {
  hexText.value = value.replace(/[^0-9a-f]/giu, '');
}

function commitHex(): void {
  hexFocused.value = false;
  if (!isValidHex(hexText.value)) {
    hexText.value = hex6.value;
    return;
  }

  const parsed = parseColor(`#${hexText.value}`);
  const withAlpha = hexText.value.length === 4 || hexText.value.length === 8;
  patch((draft) => {
    const channel = currentOf(draft);
    channel.h = parsed.h;
    channel.s = parsed.s;
    channel.v = parsed.v;
    if (withAlpha) channel.a = parsed.a;
  });
}

function onHexKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
}

function setMode(mode: ColorEditorMode): void {
  if (mode === internal.value.mode) return;
  patch((draft) => {
    draft.mode = mode;
  });
}

function setActive(index: 0 | 1): void {
  patch((draft) => (draft.active = index), false);
}

function flip(): void {
  // Reverse the colors; positions stay put (a true direction flip for 2 stops).
  patch((draft) => {
    const first = draft.stops[0].hsva;
    draft.stops[0].hsva = draft.stops[1].hsva;
    draft.stops[1].hsva = first;
  });
}

function setAngle(value: number): void {
  patch((draft) => {
    draft.angle = wrap360(value);
  });
}

// Select on press; reposition only on drag (so a click just selects the stop).
function onStopDown(index: 0 | 1, event: PointerEvent): void {
  if (!interactive.value || event.button !== 0) return;
  interacting = true;
  if (internal.value.active !== index) setActive(index);

  const element = gradientBar.value;
  if (!element) {
    interacting = false;
    return;
  }

  const rect = element.getBoundingClientRect();
  const pad = colorEditorThumbPx / 2;

  const move = (clientX: number): void =>
    patch((draft) => {
      draft.stops[index].position = r0(
        clamp((clientX - rect.left - pad) / (rect.width - 2 * pad), 0, 1) * 100,
      );
    });

  const onMove = (moveEvent: PointerEvent): void => {
    moveEvent.preventDefault();
    move(moveEvent.clientX);
  };

  const onUp = (): void => {
    interacting = false;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function onStopKey(index: 0 | 1, event: KeyboardEvent): void {
  if (!interactive.value) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

  const step = kstep(event);
  event.preventDefault();
  patch((draft) => {
    draft.stops[index].position = clamp(
      draft.stops[index].position + (event.key === 'ArrowRight' ? step : -step),
      0,
      100,
    );
  });
}

function applySwatch(swatch: ColorInput): void {
  patch((draft) => {
    const channel = currentOf(draft);
    const parsed = parseColor(swatch);
    channel.h = parsed.h;
    channel.s = parsed.s;
    channel.v = parsed.v;
    channel.a = parsed.a;
  });
}

function setAlphaPercent(value: number): void {
  patch((draft) => (currentOf(draft).a = clamp(value / 100, 0, 1)));
}

const showGradientBar = computed(
  () => d.value.gradient && internal.value.mode === 'linear',
);

const stopThumbs = computed(() =>
  internal.value.stops.map((stop, index) => ({
    color: buildColorValue(stop.hsva),
    position: stop.position,
    index: index as 0 | 1,
  })),
);

const previewStops = computed(() =>
  [...stopThumbs.value]
    .map((stop) => ({ color: stop.color, position: stop.position }))
    .sort((a, b) => a.position - b.position),
);

const swatchList = computed(() =>
  (d.value.swatches ?? []).map((swatch) => ({
    input: swatch,
    value: buildColorValue(parseColor(swatch)),
  })),
);

const rootClass = computed(() =>
  cn('cladd-coloreditor flex w-full flex-col gap-2.5', attrs.class),
);
const bodyClass = computed(() =>
  cn(
    'flex w-full flex-col gap-2.5',
    d.value.disabled && 'pointer-events-none opacity-50',
  ),
);
const areaClass = computed(() =>
  cn(
    'relative w-full touch-none rounded-cladd-lg select-none',
    colorEditorAreaHeight,
    interactive.value && 'cursor-crosshair',
    d.value.areaClassName,
  ),
);
const barClass = cn(
  'relative w-full touch-none rounded-full select-none',
  colorEditorBarHeight,
);
const thumbClass = cn(
  colorEditorThumbClass,
  'pointer-events-none top-1/2',
  colorEditorThumb,
);
const swatchClass = cn(
  'relative shrink-0 overflow-hidden rounded-cladd-2xs shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)] transition-transform hover:scale-110',
  colorEditorSwatch,
);
const areaStyle = computed(() => ({
  background: `linear-gradient(to top, #000 0%, rgba(0,0,0,0) 100%), linear-gradient(to right, #fff 0%, rgba(255,255,255,0) 100%), hsl(${cur.value.h}, 100%, 50%)`,
}));
const alphaTrackStyle = computed(() => ({
  background: `linear-gradient(to right, rgba(${rgb.value.r},${rgb.value.g},${rgb.value.b},0) 0%, rgba(${rgb.value.r},${rgb.value.g},${rgb.value.b},1) 100%)`,
}));

function stopThumbClass(index: 0 | 1): string {
  return cn(
    colorEditorThumbClass,
    'top-1/2',
    colorEditorThumb,
    internal.value.active === index &&
      'z-10 ring-2 ring-cladd-primary ring-offset-1',
  );
}
</script>

<template>
  <div
    v-bind="rootAttrs"
    :class="rootClass"
    :data-disabled="d.disabled || undefined"
    :data-readonly="d.readOnly || undefined"
  >
    <slot name="header" />

    <div :class="bodyClass" data-part="body">
      <Toolbar
        v-if="d.gradient"
        class="mx-auto w-32"
        content-class-name="w-full"
        data-part="toolbar"
        :outline="d.controlOutline"
        :size="toolbarSize"
      >
        <Segmented :active-outline="d.controlOutline" class="w-full">
          <SegmentedButton
            :active="internal.mode === 'solid'"
            aria-label="Solid"
            class="flex-1"
            @click="setMode('solid')"
          >
            <SolidColorIcon />
          </SegmentedButton>
          <SegmentedButton
            :active="internal.mode === 'linear'"
            aria-label="Gradient"
            class="flex-1"
            @click="setMode('linear')"
          >
            <GradientColorIcon />
          </SegmentedButton>
        </Segmented>
      </Toolbar>

      <div v-if="showGradientBar" class="flex w-full items-center gap-2.5">
        <Button
          aria-label="Flip gradient"
          :disabled="!interactive"
          :outline="false"
          :size="d.controlSize"
          square
          variant="transparent"
          @click="flip"
        >
          <FlipIcon class="text-cladd-fg-soft" />
        </Button>

        <div
          ref="gradientBar"
          :class="
            cn('relative flex-1 touch-none rounded-full', colorEditorBarHeight)
          "
          :style="CHECKER"
        >
          <div
            class="absolute inset-0 rounded-full"
            :style="{ background: gradientPreviewCss(previewStops) }"
          />
          <div
            v-for="stop in stopThumbs"
            :key="stop.index"
            :aria-label="`Gradient stop ${stop.index + 1}`"
            :aria-valuemax="100"
            :aria-valuemin="0"
            :aria-valuenow="stop.position"
            :class="stopThumbClass(stop.index)"
            role="slider"
            :style="{
              left: thumbLeft(stop.position / 100),
              transform: 'translate(-50%, -50%)',
              backgroundColor: stop.color.css,
            }"
            :tabindex="interactive ? 0 : undefined"
            @keydown="onStopKey(stop.index, $event)"
            @pointerdown="onStopDown(stop.index, $event)"
          />
        </div>

        <Button
          v-if="d.angleControl === 'button'"
          aria-label="Rotate 45°"
          :disabled="!interactive"
          :outline="false"
          :size="d.controlSize"
          square
          variant="transparent"
          @click="setAngle(internal.angle + 45)"
        >
          <ArrowLeftIcon
            class="text-cladd-fg-soft transition-transform duration-200"
            :style="{ transform: `rotate(${internal.angle + 90}deg)` }"
          />
        </Button>
        <NumberScrubber
          v-else
          class="w-16 shrink-0"
          content-class-name="pl-1.5 gap-1"
          :disabled="!interactive"
          :display-value="(value: number) => `${value}°`"
          icon-class-name="left-1.5"
          input-class-name="text-right pl-5"
          :max="360"
          :min="0"
          :model-value="r0(internal.angle)"
          :outline="false"
          :scrubber-icon="false"
          :size="d.controlSize"
          :step="1"
          variant="transparent"
          @change="setAngle"
          @temporary-change="setAngle"
        >
          <template #icon>
            <ArrowLeftIcon
              :style="{ transform: `rotate(${internal.angle + 90}deg)` }"
            />
          </template>
        </NumberScrubber>
      </div>

      <div
        ref="areaElement"
        :class="areaClass"
        data-part="area"
        :style="areaStyle"
        @pointerdown="onAreaDown"
      >
        <div
          aria-label="Saturation and brightness"
          :aria-valuetext="`S ${r0(cur.s)}%, B ${r0(cur.v)}%`"
          :class="
            cn(colorEditorThumbClass, 'pointer-events-none', colorEditorThumb)
          "
          data-part="area-thumb"
          role="slider"
          :style="{
            left: `${cur.s}%`,
            top: `${100 - cur.v}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: opaque,
          }"
          :tabindex="interactive ? 0 : undefined"
          @keydown="onAreaKey"
        />
      </div>

      <div
        ref="hueElement"
        :class="barClass"
        data-part="hue"
        :style="{ background: colorEditorHueTrack }"
        @pointerdown="onHueDown"
      >
        <div
          aria-label="Hue"
          :aria-valuemax="360"
          :aria-valuemin="0"
          :aria-valuenow="r0(cur.h)"
          :class="thumbClass"
          role="slider"
          :style="{
            left: thumbLeft(cur.h / 360),
            transform: 'translate(-50%, -50%)',
            backgroundColor: `hsl(${cur.h}, 100%, 50%)`,
          }"
          :tabindex="interactive ? 0 : undefined"
          @keydown="onHueKey"
        />
      </div>

      <div
        v-if="d.alpha"
        ref="alphaElement"
        :class="barClass"
        data-part="alpha"
        :style="CHECKER"
        @pointerdown="onAlphaDown"
      >
        <div class="absolute inset-0 rounded-full" :style="alphaTrackStyle" />
        <div
          aria-label="Alpha"
          :aria-valuemax="100"
          :aria-valuemin="0"
          :aria-valuenow="r0(cur.a * 100)"
          :class="thumbClass"
          role="slider"
          :style="{
            left: thumbLeft(cur.a),
            transform: 'translate(-50%, -50%)',
            backgroundColor: opaque,
          }"
          :tabindex="interactive ? 0 : undefined"
          @keydown="onAlphaKey"
        />
      </div>

      <div v-if="d.inputs" class="flex w-full items-start gap-1.5">
        <div
          v-for="channel in channels"
          :key="channel.label"
          class="flex min-w-0 flex-1 flex-col items-center gap-1"
        >
          <NumberScrubber
            class="w-full"
            content-class-name="justify-between pl-1.5 gap-1"
            :disabled="!interactive"
            icon-class-name="left-1.5"
            input-class-name="text-right pl-5"
            :max="channel.max"
            :min="channel.min"
            :model-value="channel.value"
            :outline="d.controlOutline"
            :scrubber-icon="false"
            :size="d.controlSize"
            :step="1"
            @change="channel.set"
            @temporary-change="channel.set"
          >
            <template #icon>
              <span
                class="flex size-4 items-center justify-center text-cladd-xs font-medium text-cladd-fg-soft"
              >
                {{ channel.label }}
              </span>
            </template>
          </NumberScrubber>
        </div>
      </div>

      <div
        v-if="d.hexInput"
        class="grid w-full grid-cols-3 items-center gap-1.5"
      >
        <Input
          :class="cn('min-w-0', alphaInput ? 'col-span-2' : 'col-span-3')"
          icon-class-name="left-1.5"
          input-class-name="uppercase tracking-wide pl-6"
          :max-length="8"
          :model-value="hexText"
          :outline="d.controlOutline"
          :read-only="!interactive"
          :size="d.controlSize"
          @blur="commitHex"
          @focus="hexFocused = true"
          @keydown="onHexKeydown"
          @update:model-value="onHexInput"
        >
          <template #icon>
            <span
              class="flex size-4 items-center justify-center text-cladd-xs font-medium text-cladd-fg-soft"
            >
              #
            </span>
          </template>
        </Input>
        <NumberScrubber
          v-if="alphaInput"
          class="w-full"
          content-class-name="justify-between pl-1.5 gap-1"
          :disabled="!interactive"
          :display-value="(value: number) => `${value}%`"
          icon-class-name="left-1.5"
          input-class-name="text-right pl-5"
          :max="100"
          :min="0"
          :model-value="r0(cur.a * 100)"
          :outline="d.controlOutline"
          :scrubber-icon="false"
          :size="d.controlSize"
          :step="1"
          @change="setAlphaPercent"
          @temporary-change="setAlphaPercent"
        >
          <template #icon>
            <span
              class="flex size-4 items-center justify-center text-cladd-xs font-medium text-cladd-fg-soft"
            >
              A
            </span>
          </template>
        </NumberScrubber>
      </div>

      <div
        v-if="swatchList.length > 0"
        class="flex w-full flex-wrap gap-1.5"
        data-part="swatches"
      >
        <button
          v-for="(swatch, index) in swatchList"
          :key="index"
          :aria-label="swatch.value.hex"
          :class="swatchClass"
          :disabled="!interactive"
          :style="CHECKER"
          type="button"
          @click="applySwatch(swatch.input)"
        >
          <span
            class="absolute inset-0"
            :style="{ background: swatch.value.css }"
          />
        </button>
      </div>
    </div>

    <slot name="footer" />
  </div>
</template>
