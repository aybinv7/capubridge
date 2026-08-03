<script setup lang="ts">
import { computed, onUnmounted, shallowRef, useId, useSlots, watch } from "vue";

import { useAnchorPosition } from "../../composables/useAnchorPosition.ts";
import { useOverlayLifecycle } from "../../composables/useOverlayLifecycle.ts";
import { useOverlayPhase } from "../../composables/useOverlayPhase.ts";
import { provideSurfaceContext, useSurface } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import type { UiAccent } from "../../foundations/contracts.ts";
import VNodeRenderer from "../data-display/VNodeRenderer.ts";
import Surface from "../surface/Surface.vue";
import {
  buildTooltipPositionStyle,
  type OverlayOffsetValue,
  type TooltipPosition,
} from "./overlay.contracts.ts";
import { cloneTriggerNode } from "./overlayTrigger.ts";

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    ariaLabel?: string;
    delay?: number;
    disabled?: boolean;
    offset?: OverlayOffsetValue;
    position?: TooltipPosition;
    root?: string | HTMLElement;
    touchDelay?: number;
  }>(),
  {
    accent: undefined,
    ariaLabel: undefined,
    delay: 1000,
    disabled: false,
    offset: 4,
    position: "top",
    root: "body",
    touchDelay: 500,
  },
);

defineSlots<{
  default?: () => unknown;
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
const timer = shallowRef<number>();
const tooltipId = `cui-tooltip-${useId()}`;
const { anchorElement, anchorName, setAnchorElement } = useAnchorPosition();
const { phase, setPhase } = useOverlayPhase(model);

const mounted = computed(() => phase.value !== "closed");
const contentStyle = computed(() =>
  buildTooltipPositionStyle({
    anchorName: anchorName.value,
    offset: props.offset,
    position: props.position,
  }),
);

const { opened } = useOverlayLifecycle({
  element: content,
  onClose: () => emit("closing"),
  onClosed: () => emit("closed"),
  onOpen: () => emit("opening"),
  onOpened: () => emit("opened"),
  phase,
  setPhase,
});

function clearTimer(): void {
  if (timer.value !== undefined) window.clearTimeout(timer.value);
  timer.value = undefined;
}

function show(event?: PointerEvent | FocusEvent): void {
  if (props.disabled) return;
  clearTimer();
  const touch = event && "pointerType" in event && event.pointerType === "touch";
  const wait = touch ? Math.min(props.delay, props.touchDelay) : props.delay;
  timer.value = window.setTimeout(() => {
    model.value = true;
  }, wait);
}

function hide(): void {
  clearTimer();
  model.value = false;
}

function onPointerLeave(event: PointerEvent): void {
  const related = event.relatedTarget;
  if (related instanceof Node && anchorElement.value?.contains(related)) return;
  hide();
}

function syncDescription(open: boolean): void {
  const element = anchorElement.value;
  if (!element) return;
  if (open) element.setAttribute("aria-describedby", tooltipId);
  else element.removeAttribute("aria-describedby");
}

watch([model, anchorElement], ([open]) => syncDescription(open), { immediate: true });

onUnmounted(() => {
  clearTimer();
  anchorElement.value?.removeAttribute("aria-describedby");
});

const triggerNode = computed(() =>
  cloneTriggerNode(slots.trigger?.(), {
    onBlur: hide,
    onFocus: show,
    onPointerenter: show,
    onPointerleave: onPointerLeave,
    ref: setAnchorElement,
  }),
);

provideSurfaceContext(
  () => parentSurface.level.value,
  () => undefined,
);
</script>

<template>
  <VNodeRenderer v-if="triggerNode" :node="triggerNode" />
  <span
    v-else-if="slots.trigger"
    class="cui-overlay-trigger"
    @focusin="show"
    @focusout="hide"
    @pointerenter="show"
    @pointerleave="onPointerLeave"
  >
    <slot name="trigger" />
  </span>
  <Teleport :to="props.root">
    <div
      v-if="mounted"
      :id="tooltipId"
      ref="content"
      :aria-label="props.ariaLabel"
      class="cui-tooltip cui-tooltip__content cui-theme"
      :data-cui-opened="opened || undefined"
      :data-cui-theme="ui.theme.value"
      :data-position="props.position"
      role="tooltip"
      :style="contentStyle"
    >
      <Surface
        :accent="props.accent"
        class="cui-tooltip__surface"
        level="5"
        outline
        variant="gradient"
      >
        <slot />
      </Surface>
    </div>
  </Teleport>
</template>
