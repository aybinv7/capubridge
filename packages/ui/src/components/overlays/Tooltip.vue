<script setup lang="ts">
import { computed, onUnmounted, shallowRef, useAttrs, useId, useSlots, watch } from "vue";

import type { SurfaceLevelInput, UiAccent } from "../../foundations/contracts.ts";
import VNodeRenderer from "../data-display/VNodeRenderer.ts";
import { overlayTriggerClasses, resolveOverlayElement } from "./overlay.contracts.ts";
import type { OverlayOffsetValue, TooltipPosition } from "./overlay.contracts.ts";
import { cloneTriggerNode } from "./overlayTrigger.ts";
import TooltipPrimitive from "./TooltipPrimitive.vue";
import {
  clearTooltipGlobalTimeout,
  collapseTooltipGlobalTimeout,
  getTooltipGlobalTimeout,
  scheduleTooltipGlobalTimeoutReset,
} from "./tooltipTimeout.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    ariaLabel?: string;
    color?: UiAccent;
    contentClassName?: string;
    disabled?: boolean;
    offset?: OverlayOffsetValue;
    position?: TooltipPosition;
    root?: string | HTMLElement;
    surfaceLevel?: SurfaceLevelInput;
    /**
     * When `true` (default), delays showing the tooltip (500ms on touch, 1000ms on mouse) using a
     * shared global timer so successive hovers feel snappier. When `false`, it appears immediately.
     */
    timeout?: boolean;
    zIndex?: string;
  }>(),
  {
    accent: undefined,
    ariaLabel: undefined,
    color: undefined,
    contentClassName: undefined,
    disabled: false,
    offset: 4,
    position: "top",
    root: undefined,
    surfaceLevel: undefined,
    timeout: true,
    zIndex: undefined,
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

const model = defineModel<boolean>("open", { default: false });
const slots = useSlots();
const attrs = useAttrs();
const anchorElement = shallowRef<HTMLElement>();
const pointerTimeout = shallowRef<number>();
const visible = shallowRef(false);
const preventContextMenu = shallowRef(false);
const tooltipId = `cui-tooltip-${useId()}`;

function setAnchor(value: unknown): void {
  anchorElement.value = resolveOverlayElement(value);
}

function show(): void {
  if (props.disabled) return;
  clearTooltipGlobalTimeout();
  pointerTimeout.value = window.setTimeout(
    () => {
      visible.value = true;
      model.value = true;
      if (props.timeout) collapseTooltipGlobalTimeout();
    },
    props.timeout ? getTooltipGlobalTimeout() : 0,
  );
}

function hide(): void {
  visible.value = false;
  model.value = false;
  if (pointerTimeout.value !== undefined) window.clearTimeout(pointerTimeout.value);
  pointerTimeout.value = undefined;
  if (props.timeout) scheduleTooltipGlobalTimeoutReset();
}

function onClick(): void {
  if (visible.value) hide();
}

function onContextMenu(event: Event): void {
  if (preventContextMenu.value) event.preventDefault();
}

function onPointer(event: PointerEvent): void {
  const mouseEvents = ["pointerenter", "pointerleave", "pointercancel"];
  const touchEvents = ["pointerdown", "pointerup", "pointercancel"];

  if (
    (event.pointerType === "mouse" && !mouseEvents.includes(event.type)) ||
    (event.pointerType === "touch" && !touchEvents.includes(event.type))
  ) {
    return;
  }
  if (event.type === "pointerenter") show();
  if (event.type === "pointerleave" || event.type === "pointercancel") {
    preventContextMenu.value = false;
    hide();
  }
  if (event.type === "pointerdown" && !visible.value) {
    preventContextMenu.value = true;
    show();
  }
  if (event.type === "pointerup") {
    preventContextMenu.value = false;
    hide();
  }
}

// Upstream binds pointerup/pointercancel on the document so a release outside the trigger still
// dismisses; the rest sit on the trigger element itself.
watch(
  anchorElement,
  (element, previous, onCleanup) => {
    if (previous) {
      previous.removeEventListener("click", onClick);
      previous.removeEventListener("contextmenu", onContextMenu);
      previous.removeEventListener("pointerenter", onPointer);
      previous.removeEventListener("pointerdown", onPointer);
      previous.removeEventListener("pointerleave", onPointer);
    }
    if (!element) return;
    element.addEventListener("click", onClick);
    element.addEventListener("contextmenu", onContextMenu);
    element.addEventListener("pointerenter", onPointer);
    element.addEventListener("pointerdown", onPointer);
    element.addEventListener("pointerleave", onPointer);
    document.addEventListener("pointerup", onPointer);
    document.addEventListener("pointercancel", onPointer);
    onCleanup(() => {
      element.removeEventListener("click", onClick);
      element.removeEventListener("contextmenu", onContextMenu);
      element.removeEventListener("pointerenter", onPointer);
      element.removeEventListener("pointerdown", onPointer);
      element.removeEventListener("pointerleave", onPointer);
      document.removeEventListener("pointerup", onPointer);
      document.removeEventListener("pointercancel", onPointer);
    });
  },
  { immediate: true },
);

// Not upstream: keeps the trigger and the tooltip associated for assistive tech.
function syncDescription(open: boolean): void {
  const element = anchorElement.value;
  if (!element) return;
  if (open) element.setAttribute("aria-describedby", tooltipId);
  else element.removeAttribute("aria-describedby");
}

watch([model, anchorElement], ([open]) => syncDescription(open), { immediate: true });

onUnmounted(() => {
  if (pointerTimeout.value !== undefined) window.clearTimeout(pointerTimeout.value);
  anchorElement.value?.removeAttribute("aria-describedby");
});

const triggerNode = computed(() => cloneTriggerNode(slots.trigger?.(), { ref: setAnchor }));
const primitiveAttrs = computed(() => {
  const { class: consumerClass, ...rest } = attrs;
  return { attrs: rest, class: consumerClass };
});
</script>

<template>
  <VNodeRenderer v-if="triggerNode" :node="triggerNode" />
  <span v-else-if="slots.trigger" :class="overlayTriggerClasses" :ref="setAnchor">
    <slot name="trigger" />
  </span>
  <TooltipPrimitive
    v-bind="primitiveAttrs.attrs"
    v-model:open="model"
    :accent="props.accent"
    :anchor-element="anchorElement"
    :aria-label="props.ariaLabel"
    :class="primitiveAttrs.class"
    :color="props.color"
    :content-class-name="props.contentClassName"
    :id="tooltipId"
    :offset="props.offset"
    :position="props.position"
    role="tooltip"
    :root="props.root"
    :surface-level="props.surfaceLevel"
    :z-index="props.zIndex"
    @closed="emit('closed')"
    @closing="emit('closing')"
    @opened="emit('opened')"
    @opening="emit('opening')"
  >
    <slot />
  </TooltipPrimitive>
</template>
