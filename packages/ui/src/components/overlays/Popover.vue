<script setup lang="ts">
import { computed, shallowRef, useAttrs, useSlots, watch } from "vue";

import { useAnchorPosition } from "../../composables/useAnchorPosition.ts";
import { useOverlayDismiss } from "../../composables/useOverlayDismiss.ts";
import { useOverlayLifecycle } from "../../composables/useOverlayLifecycle.ts";
import { useOverlayPhase } from "../../composables/useOverlayPhase.ts";
import { provideSurfaceColorReset } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import type { SurfaceLevelInput, SurfaceVariant, UiAccent } from "../../foundations/contracts.ts";
import { cn } from "../../shared/cn.ts";
import VNodeRenderer from "../data-display/VNodeRenderer.ts";
import Surface from "../surface/Surface.vue";
import Backdrop from "./Backdrop.vue";
import {
  buildAnchorRectStyle,
  buildPopoverPositionStyle,
  overlayBackdropDurationClasses,
  overlayBackdropTransparentClasses,
  overlayTriggerClasses,
  popoverBackdropTintClasses,
  popoverChildOverlaySelector,
  popoverClosingClasses,
  popoverContainerClasses,
  popoverContentClasses,
  popoverEnterDurationClasses,
  popoverFallbackPosition,
  popoverHiddenClasses,
  popoverOpenedClasses,
  popoverPositionConfigs,
  popoverSurfaceClasses,
  resolveOverlayElement,
  type PopoverOffset,
  type PopoverPosition,
} from "./overlay.contracts.ts";
import { popoverRootContextKey, useOverlayRootContext } from "./overlayRootContext.ts";
import { cloneTriggerNode } from "./overlayTrigger.ts";
import { usePopoverChain } from "./popoverChain.ts";

// Upstream spreads `...rest` onto the popover Surface and keeps `className` (the Surface root)
// separate from `contentClassName` (the inner scrollable area). Vue's `class`/attr fallthrough
// would otherwise land on the trigger, so attrs are routed explicitly.
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    /**
     * Element the popover anchors against. Takes precedence over the `trigger` slot and over the
     * anchor a `PopoverTrigger` registered on a surrounding `PopoverRoot` (upstream's `anchorRef`).
     */
    anchorElement?: HTMLElement;
    anchorRect?: DOMRectReadOnly;
    backdrop?: boolean;
    backdropTransparent?: boolean;
    closeOnBackdropClick?: boolean;
    closeOnEscape?: boolean;
    color?: UiAccent;
    contentClassName?: string;
    disabled?: boolean;
    lazy?: boolean;
    offset?: PopoverOffset;
    outline?: boolean;
    position?: PopoverPosition;
    root?: string | HTMLElement;
    surfaceLevel?: SurfaceLevelInput;
    variant?: SurfaceVariant;
    viewportMargin?: number;
  }>(),
  {
    accent: undefined,
    anchorElement: undefined,
    anchorRect: undefined,
    backdrop: false,
    backdropTransparent: false,
    closeOnBackdropClick: true,
    closeOnEscape: true,
    color: undefined,
    contentClassName: undefined,
    disabled: false,
    lazy: false,
    offset: undefined,
    outline: undefined,
    position: "bottom",
    root: undefined,
    surfaceLevel: undefined,
    variant: undefined,
    viewportMargin: 4,
  },
);

defineSlots<{
  default?: (props: { close: () => void }) => unknown;
  trigger?: () => unknown;
}>();

const emit = defineEmits<{
  closed: [];
  closing: [];
  opened: [];
  opening: [];
}>();

const modelOpen = defineModel<boolean>("open", { default: undefined });
const slots = useSlots();
const attrs = useAttrs();
const surfaceAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const ui = useUiContext();
const root = useOverlayRootContext(popoverRootContextKey);
const container = shallowRef<HTMLElement>();
const surface = shallowRef<HTMLElement>();
const { anchorName, setAnchorElement } = useAnchorPosition();

// Own `open` wins, then the surrounding PopoverRoot's state, then `false` — upstream's
// `open ?? ctx?.open ?? false`. Writes go back to whichever of the two is in play.
const model = computed<boolean>({
  get: () => modelOpen.value ?? root?.open.value ?? false,
  set: (value) => {
    if (modelOpen.value !== undefined || !root) modelOpen.value = value;
    else root.setOpen(value);
  },
});

const { phase, setPhase } = useOverlayPhase(model);

const mounted = computed(() => phase.value !== "closed");
const currentAccent = computed(() => props.color ?? props.accent);
const currentVariant = computed(
  () => props.variant ?? (ui.theme.value === "light" ? "solid" : "gradient"),
);
const currentOutline = computed(() => props.outline ?? ui.theme.value === "dark");
const currentSurfaceLevel = computed(
  () => props.surfaceLevel ?? (ui.theme.value === "light" ? 1 : "+1"),
);
const positionConfig = computed(
  () => popoverPositionConfigs[props.position] ?? popoverPositionConfigs[popoverFallbackPosition],
);
const surfaceStyle = computed(() =>
  buildPopoverPositionStyle({
    anchorName: anchorName.value,
    offset: props.offset,
    position: props.position,
    viewportMargin: props.viewportMargin,
  }),
);
const anchorRectStyle = computed(() =>
  props.anchorRect ? buildAnchorRectStyle(props.anchorRect, anchorName.value) : undefined,
);
const containerClass = popoverContainerClasses;
const teleportTarget = computed(() => props.root ?? ui.overlaysRoot.value);

function setSurface(value: unknown): void {
  surface.value = resolveOverlayElement(value);
}

function close(): void {
  model.value = false;
}

function toggle(): void {
  if (props.disabled) return;
  model.value = !model.value;
}

function onBackdropClick(): void {
  if (props.closeOnBackdropClick) close();
}

function hasChildOverlay(): boolean {
  const next = container.value?.nextElementSibling;
  return Boolean(next?.matches(popoverChildOverlaySelector));
}

const { opened } = useOverlayLifecycle({
  closeOnEscape: () => props.closeOnEscape && !hasChildOverlay(),
  element: surface,
  lazy: () => props.lazy,
  onClose: () => emit("closing"),
  onClosed: () => emit("closed"),
  onOpen: () => emit("opening"),
  onOpened: () => emit("opened"),
  phase,
  setPhase,
});

useOverlayDismiss({
  closeOnOutsideClick: () => props.closeOnBackdropClick,
  container,
  onClose: close,
  opened,
});

usePopoverChain({ close, phase });

const surfaceClass = computed(() =>
  cn(
    popoverSurfaceClasses,
    opened.value && popoverOpenedClasses,
    (phase.value === "opened" || (phase.value === "opening" && opened.value)) &&
      popoverEnterDurationClasses,
    phase.value === "closing" && popoverClosingClasses,
    (phase.value === "closing" || !opened.value) && popoverHiddenClasses,
    positionConfig.value.origin,
    attrs.class,
  ),
);
const contentClass = computed(() => cn(popoverContentClasses, props.contentClassName));
const backdropClass = computed(() =>
  cn(
    overlayBackdropDurationClasses,
    props.backdropTransparent ? overlayBackdropTransparentClasses : popoverBackdropTintClasses,
    opened.value ? "opacity-100" : "opacity-0",
  ),
);

const triggerNode = computed(() =>
  cloneTriggerNode(slots.trigger?.(), { onClick: toggle, ref: setAnchorElement }),
);

// An explicit `anchorElement` wins, then our own `trigger` slot, then the element a sibling
// `PopoverTrigger` registered on the surrounding `PopoverRoot` — upstream's
// `anchorRef ?? ctx?.anchorRef`.
watch(
  () => props.anchorElement ?? (slots.trigger ? undefined : root?.anchor.value),
  (element) => {
    if (element) setAnchorElement(element);
  },
  { immediate: true },
);

provideSurfaceColorReset();
</script>

<template>
  <VNodeRenderer v-if="triggerNode" :node="triggerNode" />
  <span v-else-if="slots.trigger" :class="overlayTriggerClasses" @click="toggle">
    <slot name="trigger" />
  </span>
  <Teleport :to="teleportTarget">
    <div v-if="mounted" ref="container" :class="containerClass">
      <Backdrop v-if="props.backdrop" :class="backdropClass" @click="onBackdropClick" />
      <div v-if="anchorRectStyle" aria-hidden="true" :style="anchorRectStyle" />
      <Surface
        v-bind="surfaceAttrs"
        :ref="setSurface"
        :accent="currentAccent"
        :class="surfaceClass"
        :content-class-name="contentClass"
        data-part="content"
        :data-cui-opened="opened || undefined"
        :data-position="props.position"
        :level="currentSurfaceLevel"
        :outline="currentOutline"
        :style="surfaceStyle"
        :variant="currentVariant"
      >
        <slot :close="close" />
      </Surface>
    </div>
  </Teleport>
</template>
