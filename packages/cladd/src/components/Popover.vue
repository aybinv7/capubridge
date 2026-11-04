<script setup lang="ts">
import { computed, shallowRef, useAttrs, useSlots, watch } from 'vue';

import { useAnchorPosition } from '../composables/useAnchorPosition.ts';
import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { useOverlayDismiss } from '../composables/useOverlayDismiss.ts';
import { useOverlayLifecycle } from '../composables/useOverlayLifecycle.ts';
import { useOverlayPhase } from '../composables/useOverlayPhase.ts';
import {
  provideSurfaceColorReset,
  useSurface,
} from '../contexts/surfaceContext.ts';
import { useUiContext } from '../contexts/uiContext.ts';
import { resolveSurfaceLevel } from '../foundations/surfaceLevel.ts';
import { cn } from '../shared/cn.ts';
import Backdrop from './Backdrop.vue';
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
} from './overlay.contracts.ts';
import {
  popoverRootContextKey,
  useOverlayRootContext,
} from './overlayRootContext.ts';
import { cloneTriggerNode } from './overlayTrigger.ts';
import { usePopoverChain } from './popoverChain.ts';
import Surface from './Surface.vue';
import SurfaceContextProvider from './SurfaceContextProvider.vue';
import VNodeRenderer from './VNodeRenderer.ts';

// Upstream spreads `...rest` onto the popover Surface and keeps `className` (the Surface root)
// separate from `contentClassName` (the inner scrollable area). Vue's `class`/attr fallthrough
// would otherwise land on the trigger, so attrs are routed explicitly.
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverProps>(), {
  as: undefined,
  anchorElement: undefined,
  anchorRef: undefined,
  anchorRect: undefined,
  backdrop: undefined,
  backdropTransparent: undefined,
  bgClassName: undefined,
  clickable: undefined,
  closeOnBackdropClick: undefined,
  closeOnEscape: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  lazy: undefined,
  offset: undefined,
  outline: undefined,
  overlayClassName: undefined,
  overlayPosition: undefined,
  position: undefined,
  root: undefined,
  pressed: undefined,
  surfaceLevel: undefined,
  variant: undefined,
  viewportMargin: undefined,
  wrapContent: undefined,
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

const modelOpen = defineModel<boolean | undefined>('open', {
  default: undefined,
});
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
const d = useComponentDefaults('Popover', props, {
  backdrop: false,
  backdropTransparent: false,
  closeOnBackdropClick: true,
  closeOnEscape: true,
  disabled: false,
  lazy: false,
  position: 'bottom' as NonNullable<PopoverProps['position']>,
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

const mounted = computed(() => phase.value !== 'closed');
const currentAccent = computed(() => d.value.color);
const currentVariant = computed(
  () => d.value.variant ?? (ui.theme.value === 'light' ? 'solid' : 'gradient'),
);
const currentOutline = computed(
  () => d.value.outline ?? ui.theme.value === 'dark',
);
const currentSurfaceLevel = computed(
  () => d.value.surfaceLevel ?? (ui.theme.value === 'light' ? 1 : '+1'),
);

// Mirrors upstream's `PopoverSurfaceReset` (`Popover.tsx:388-396`): once the
// content `Surface` resolves its own level, a light-theme popover sitting at
// level 1 flattens back to level 0 for its own content so nested surfaces
// don't stack an extra tone. `Surface` computes its published level the same
// way (`resolveSurfaceLevel` against its own parent context), so replicate
// the same math here against the ambient level Popover itself sees — that
// ambient level is what `Surface` will also see as its parent, since
// `provideSurfaceColorReset` below only touches color, not level.
const ambientSurface = useSurface();
const resolvedSurfaceLevel = computed(() =>
  resolveSurfaceLevel(currentSurfaceLevel.value, ambientSurface.level.value),
);
const flattenSurfaceLevel = computed(
  () => ui.theme.value === 'light' && resolvedSurfaceLevel.value === 1,
);
const positionConfig = computed(
  () =>
    popoverPositionConfigs[d.value.position] ??
    popoverPositionConfigs[popoverFallbackPosition],
);
const surfaceStyle = computed(() =>
  buildPopoverPositionStyle({
    anchorName: anchorName.value,
    offset: d.value.offset,
    position: d.value.position,
    viewportMargin: d.value.viewportMargin,
  }),
);
const resolvedAnchorRect = computed(() => {
  const raw = d.value.anchorRect as unknown;
  if (!raw) return undefined;
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'value' in (raw as Record<string, unknown>)
  ) {
    const maybeRef = (raw as { value: unknown }).value;
    if (maybeRef instanceof DOMRect) return maybeRef as DOMRectReadOnly;
    if (
      maybeRef &&
      typeof maybeRef === 'object' &&
      'left' in (maybeRef as Record<string, unknown>)
    )
      return maybeRef as DOMRectReadOnly;
  }
  return raw as DOMRectReadOnly;
});
const anchorRectStyle = computed(() =>
  resolvedAnchorRect.value
    ? buildAnchorRectStyle(resolvedAnchorRect.value, anchorName.value)
    : undefined,
);
const containerClass = popoverContainerClasses;
const teleportTarget = computed(() => {
  const root = d.value.root as unknown;
  if (root === false) return undefined;
  return (root as string | HTMLElement | undefined) ?? ui.overlaysRoot.value;
});
const isInline = computed(() => d.value.root === false);
const resolvedAnchorElement = computed(
  () => d.value.anchorElement ?? d.value.anchorRef,
);

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
  onClose: () => emit('closing'),
  onClosed: () => emit('closed'),
  onOpen: () => emit('opening'),
  onOpened: () => emit('opened'),
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
    (phase.value === 'opened' || (phase.value === 'opening' && opened.value)) &&
      popoverEnterDurationClasses,
    phase.value === 'closing' && popoverClosingClasses,
    (phase.value === 'closing' || !opened.value) && popoverHiddenClasses,
    positionConfig.value.origin,
    attrs.class,
  ),
);
const contentClass = computed(() =>
  cn(popoverContentClasses, d.value.contentClassName),
);
const backdropClass = computed(() =>
  cn(
    overlayBackdropDurationClasses,
    d.value.backdropTransparent
      ? overlayBackdropTransparentClasses
      : popoverBackdropTintClasses,
    opened.value ? 'opacity-100' : 'opacity-0',
  ),
);

const triggerNode = computed(() =>
  cloneTriggerNode(slots.trigger?.(), {
    onClick: toggle,
    ref: setAnchorElement,
  }),
);

// An explicit `anchorElement`/`anchorRef` wins, then our own `trigger` slot, then the element a sibling
// `PopoverTrigger` registered on the surrounding `PopoverRoot` — upstream's
// `anchorRef ?? ctx?.anchorRef`.
watch(
  () =>
    resolvedAnchorElement.value ??
    (slots.trigger ? undefined : root?.anchor.value),
  (element) => {
    if (element) setAnchorElement(element);
  },
  { immediate: true },
);

provideSurfaceColorReset();
</script>

<template>
  <VNodeRenderer v-if="triggerNode" :node="triggerNode" />
  <span
    v-else-if="slots.trigger"
    :class="overlayTriggerClasses"
    @click="toggle"
  >
    <slot name="trigger" />
  </span>
  <Teleport v-if="!isInline" :to="teleportTarget">
    <div v-if="mounted" ref="container" :class="containerClass">
      <Backdrop
        v-if="d.backdrop"
        :class="backdropClass"
        @click="onBackdropClick"
      />
      <div v-if="anchorRectStyle" aria-hidden="true" :style="anchorRectStyle" />
      <Surface
        v-bind="surfaceAttrs"
        :ref="setSurface"
        :as="d.as"
        :bg-class-name="d.bgClassName"
        :color="currentAccent"
        :class="surfaceClass"
        :clickable="d.clickable"
        :content-class-name="contentClass"
        data-part="content"
        :data-open="opened || undefined"
        :data-position="d.position"
        :level="currentSurfaceLevel"
        :outline="currentOutline"
        :overlay-class-name="d.overlayClassName"
        :overlay-position="d.overlayPosition"
        :pressed="d.pressed"
        :style="surfaceStyle"
        :variant="currentVariant"
        :wrap-content="d.wrapContent"
      >
        <SurfaceContextProvider v-if="flattenSurfaceLevel" :level="0">
          <slot :close="close" />
        </SurfaceContextProvider>
        <slot v-else :close="close" />
      </Surface>
    </div>
  </Teleport>
  <div v-if="isInline && mounted" ref="container" :class="containerClass">
    <Backdrop
      v-if="d.backdrop"
      :class="backdropClass"
      @click="onBackdropClick"
    />
    <div v-if="anchorRectStyle" aria-hidden="true" :style="anchorRectStyle" />
    <Surface
      v-bind="surfaceAttrs"
      :ref="setSurface"
      :as="d.as"
      :bg-class-name="d.bgClassName"
      :color="currentAccent"
      :class="surfaceClass"
      :clickable="d.clickable"
      :content-class-name="contentClass"
      data-part="content"
      :data-open="opened || undefined"
      :data-position="d.position"
      :level="currentSurfaceLevel"
      :outline="currentOutline"
      :overlay-class-name="d.overlayClassName"
      :overlay-position="d.overlayPosition"
      :pressed="d.pressed"
      :style="surfaceStyle"
      :variant="currentVariant"
      :wrap-content="d.wrapContent"
    >
      <SurfaceContextProvider v-if="flattenSurfaceLevel" :level="0">
        <slot :close="close" />
      </SurfaceContextProvider>
      <slot v-else :close="close" />
    </Surface>
  </div>
</template>
