<script setup lang="ts">
import { computed, shallowRef, useSlots } from "vue";

import { useAnchorPosition } from "../../composables/useAnchorPosition.ts";
import { useOverlayDismiss } from "../../composables/useOverlayDismiss.ts";
import { useOverlayLifecycle } from "../../composables/useOverlayLifecycle.ts";
import { useOverlayPhase } from "../../composables/useOverlayPhase.ts";
import { provideSurfaceContext, useSurface } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import type { SurfaceLevelInput, SurfaceVariant, UiAccent } from "../../foundations/contracts.ts";
import VNodeRenderer from "../data-display/VNodeRenderer.ts";
import Surface from "../surface/Surface.vue";
import {
  buildAnchorRectStyle,
  buildPopoverPositionStyle,
  popoverChildOverlaySelector,
  type PopoverOffset,
  type PopoverPosition,
} from "./overlay.contracts.ts";
import { cloneTriggerNode } from "./overlayTrigger.ts";
import { usePopoverChain } from "./popoverChain.ts";

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
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
    root: "body",
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

const model = defineModel<boolean>({ default: false });
const slots = useSlots();
const ui = useUiContext();
const parentSurface = useSurface();
const content = shallowRef<HTMLElement>();
const { anchorName, setAnchorElement } = useAnchorPosition();
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
const contentStyle = computed(() =>
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

function close(): void {
  model.value = false;
}

function toggle(): void {
  if (props.disabled) return;
  model.value = !model.value;
}

function hasChildOverlay(): boolean {
  const next = content.value?.nextElementSibling;
  return Boolean(next?.matches(popoverChildOverlaySelector));
}

const { opened } = useOverlayLifecycle({
  closeOnEscape: () => props.closeOnEscape && !hasChildOverlay(),
  element: content,
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
  container: content,
  onClose: close,
  opened,
});

usePopoverChain({ close, phase });

const triggerNode = computed(() =>
  cloneTriggerNode(slots.trigger?.(), { onClick: toggle, ref: setAnchorElement }),
);

provideSurfaceContext(
  () => parentSurface.level.value,
  () => undefined,
);
</script>

<template>
  <VNodeRenderer v-if="triggerNode" :node="triggerNode" />
  <span v-else-if="slots.trigger" class="cui-overlay-trigger" @click="toggle">
    <slot name="trigger" />
  </span>
  <Teleport :to="props.root">
    <template v-if="mounted">
      <div
        v-if="anchorRectStyle"
        aria-hidden="true"
        class="cui-popover__anchor-rect"
        :style="anchorRectStyle"
      />
      <div
        v-if="props.backdrop"
        class="cui-popover__backdrop"
        :data-cui-opened="opened || undefined"
        :data-transparent="props.backdropTransparent || undefined"
      />
      <div
        ref="content"
        class="cui-popover cui-popover__content cui-theme"
        :class="props.contentClassName"
        :data-cui-accent="currentAccent"
        :data-cui-opened="opened || undefined"
        :data-cui-theme="ui.theme.value"
        :data-position="props.position"
        :style="contentStyle"
      >
        <Surface
          :accent="currentAccent"
          class="cui-popover__surface"
          :level="currentSurfaceLevel"
          :outline="currentOutline"
          :variant="currentVariant"
        >
          <slot :close="close" />
        </Surface>
      </div>
    </template>
  </Teleport>
</template>
