<script setup lang="ts">
import { computed, shallowRef, useAttrs, useSlots, watch } from "vue";

import { useAnchorPosition } from "../../composables/useAnchorPosition.ts";
import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { useOverlayDismiss } from "../../composables/useOverlayDismiss.ts";
import { useOverlayLifecycle } from "../../composables/useOverlayLifecycle.ts";
import { useOverlayPhase } from "../../composables/useOverlayPhase.ts";
import { provideSurfaceColorReset } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
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
  type PopoverProps,
} from "./overlay.contracts.ts";
import { popoverRootContextKey, useOverlayRootContext } from "./overlayRootContext.ts";
import { cloneTriggerNode } from "./overlayTrigger.ts";
import { usePopoverChain } from "./popoverChain.ts";

// Upstream spreads `...rest` onto the popover Surface and keeps `className` (the Surface root)
// separate from `contentClassName` (the inner scrollable area). Vue's `class`/attr fallthrough
// would otherwise land on the trigger, so attrs are routed explicitly.
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverProps>(), {
  accent: undefined,
  anchorElement: undefined,
  anchorRect: undefined,
  backdrop: undefined,
  backdropTransparent: undefined,
  closeOnBackdropClick: undefined,
  closeOnEscape: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  lazy: undefined,
  offset: undefined,
  outline: undefined,
  position: undefined,
  root: undefined,
  surfaceLevel: undefined,
  variant: undefined,
  viewportMargin: undefined,
});

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
const d = useComponentDefaults("Popover", props, {
  backdrop: false,
  backdropTransparent: false,
  closeOnBackdropClick: true,
  closeOnEscape: true,
  disabled: false,
  lazy: false,
  position: "bottom" as PopoverProps["position"],
  viewportMargin: 4,
});

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
const currentAccent = computed(() => d.value.color ?? d.value.accent);
const currentVariant = computed(
  () => d.value.variant ?? (ui.theme.value === "light" ? "solid" : "gradient"),
);
const currentOutline = computed(() => d.value.outline ?? ui.theme.value === "dark");
const currentSurfaceLevel = computed(
  () => d.value.surfaceLevel ?? (ui.theme.value === "light" ? 1 : "+1"),
);
const positionConfig = computed(
  () => popoverPositionConfigs[d.value.position] ?? popoverPositionConfigs[popoverFallbackPosition],
);
const surfaceStyle = computed(() =>
  buildPopoverPositionStyle({
    anchorName: anchorName.value,
    offset: d.value.offset,
    position: d.value.position,
    viewportMargin: d.value.viewportMargin,
  }),
);
const anchorRectStyle = computed(() =>
  d.value.anchorRect ? buildAnchorRectStyle(d.value.anchorRect, anchorName.value) : undefined,
);
const containerClass = popoverContainerClasses;
const teleportTarget = computed(() => d.value.root ?? ui.overlaysRoot.value);

function setSurface(value: unknown): void {
  surface.value = resolveOverlayElement(value);
}

function close(): void {
  model.value = false;
}

function toggle(): void {
  if (d.value.disabled) return;
  model.value = !model.value;
}

function onBackdropClick(): void {
  if (d.value.closeOnBackdropClick) close();
}

function hasChildOverlay(): boolean {
  const next = container.value?.nextElementSibling;
  return Boolean(next?.matches(popoverChildOverlaySelector));
}

const { opened } = useOverlayLifecycle({
  closeOnEscape: () => d.value.closeOnEscape && !hasChildOverlay(),
  element: surface,
  lazy: () => d.value.lazy,
  onClose: () => emit("closing"),
  onClosed: () => emit("closed"),
  onOpen: () => emit("opening"),
  onOpened: () => emit("opened"),
  phase,
  setPhase,
});

useOverlayDismiss({
  closeOnOutsideClick: () => d.value.closeOnBackdropClick,
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
const contentClass = computed(() => cn(popoverContentClasses, d.value.contentClassName));
const backdropClass = computed(() =>
  cn(
    overlayBackdropDurationClasses,
    d.value.backdropTransparent ? overlayBackdropTransparentClasses : popoverBackdropTintClasses,
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
  () => d.value.anchorElement ?? (slots.trigger ? undefined : root?.anchor.value),
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
      <Backdrop v-if="d.backdrop" :class="backdropClass" @click="onBackdropClick" />
      <div v-if="anchorRectStyle" aria-hidden="true" :style="anchorRectStyle" />
      <Surface
        v-bind="surfaceAttrs"
        :ref="setSurface"
        :accent="currentAccent"
        :class="surfaceClass"
        :content-class-name="contentClass"
        data-part="content"
        :data-open="opened || undefined"
        :data-position="d.position"
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
