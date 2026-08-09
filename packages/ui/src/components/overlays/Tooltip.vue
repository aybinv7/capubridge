<script setup lang="ts">
import { computed, onUnmounted, shallowRef, useAttrs, useId, useSlots, watch } from "vue";

import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import VNodeRenderer from "../data-display/VNodeRenderer.ts";
import {
  overlayTriggerClasses,
  resolveOverlayElement,
  type TooltipProps,
} from "./overlay.contracts.ts";
import { cloneTriggerNode } from "./overlayTrigger.ts";
import TooltipPrimitive from "./TooltipPrimitive.vue";
import {
  clearTooltipGlobalTimeout,
  collapseTooltipGlobalTimeout,
  getTooltipGlobalTimeout,
  scheduleTooltipGlobalTimeoutReset,
} from "./tooltipTimeout.ts";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipProps>(), {
  accent: undefined,
  ariaLabel: undefined,
  color: undefined,
  contentClassName: undefined,
  disabled: undefined,
  offset: undefined,
  position: undefined,
  root: undefined,
  surfaceLevel: undefined,
  timeout: undefined,
  zIndex: undefined,
});

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
const d = useComponentDefaults("Tooltip", props, {
  disabled: false,
  offset: 4,
  position: "top" as TooltipProps["position"],
  timeout: true,
});

function setAnchor(value: unknown): void {
  anchorElement.value = resolveOverlayElement(value);
}

function show(): void {
  if (d.value.disabled) return;
  clearTooltipGlobalTimeout();
  pointerTimeout.value = window.setTimeout(
    () => {
      visible.value = true;
      model.value = true;
      if (d.value.timeout) collapseTooltipGlobalTimeout();
    },
    d.value.timeout ? getTooltipGlobalTimeout() : 0,
  );
}

function hide(): void {
  visible.value = false;
  model.value = false;
  if (pointerTimeout.value !== undefined) window.clearTimeout(pointerTimeout.value);
  pointerTimeout.value = undefined;
  if (d.value.timeout) scheduleTooltipGlobalTimeoutReset();
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
    :accent="d.accent"
    :anchor-element="anchorElement"
    :aria-label="d.ariaLabel"
    :class="primitiveAttrs.class"
    :color="d.color"
    :content-class-name="d.contentClassName"
    :id="tooltipId"
    :offset="d.offset"
    :position="d.position"
    role="tooltip"
    :root="d.root"
    :surface-level="d.surfaceLevel"
    :z-index="d.zIndex"
    @closed="emit('closed')"
    @closing="emit('closing')"
    @opened="emit('opened')"
    @opening="emit('opening')"
  >
    <slot />
  </TooltipPrimitive>
</template>
