<script setup lang="ts">
import { computed, shallowRef, useAttrs, watch } from "vue";

import { useAnchorPosition } from "../../composables/useAnchorPosition.ts";
import { useComponentDefaults } from "../../composables/useComponentDefaults.ts";
import { useOverlayLifecycle } from "../../composables/useOverlayLifecycle.ts";
import { useOverlayPhase } from "../../composables/useOverlayPhase.ts";
import { provideSurfaceColorReset } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import { cn } from "../../shared/cn.ts";
import Surface from "../surface/Surface.vue";
import {
  buildTooltipPositionStyle,
  resolveOverlayElement,
  tooltipContainerClasses,
  tooltipContentClasses,
  tooltipDurationClasses,
  tooltipHiddenClasses,
  tooltipOpenedClasses,
  tooltipOrigins,
  tooltipSurfaceClasses,
  tooltipZIndexClasses,
  type TooltipPrimitiveProps,
} from "./overlay.contracts.ts";

// Upstream keeps `className` (the tooltip Surface) separate from `contentClassName`.
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipPrimitiveProps>(), {
  accent: undefined,
  anchorElement: undefined,
  color: undefined,
  contentClassName: undefined,
  offset: undefined,
  position: undefined,
  root: undefined,
  surfaceLevel: undefined,
  zIndex: undefined,
});

defineSlots<{
  default?: () => unknown;
}>();

const emit = defineEmits<{
  closed: [];
  closing: [];
  opened: [];
  opening: [];
}>();

const model = defineModel<boolean>("open", { default: false });
const attrs = useAttrs();
const ui = useUiContext();
const surface = shallowRef<HTMLElement>();
const { anchorName, setAnchorElement } = useAnchorPosition();
const d = useComponentDefaults("TooltipPrimitive", props, {
  offset: 4,
  position: "top" as TooltipPrimitiveProps["position"],
  zIndex: tooltipZIndexClasses,
});
const { phase, setPhase } = useOverlayPhase(model);

const mounted = computed(() => phase.value !== "closed");
const currentAccent = computed(() => d.value.color ?? d.value.accent);
const currentSurfaceLevel = computed(
  () => d.value.surfaceLevel ?? (ui.theme.value === "light" ? 1 : 5),
);
const surfaceStyle = computed(() =>
  buildTooltipPositionStyle({
    anchorName: anchorName.value,
    offset: d.value.offset,
    position: d.value.position,
  }),
);
const containerClass = tooltipContainerClasses;
const teleportTarget = computed(() => d.value.root ?? ui.overlaysRoot.value);
const surfaceAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});

function setSurface(value: unknown): void {
  surface.value = resolveOverlayElement(value);
}

const { opened } = useOverlayLifecycle({
  element: surface,
  onClose: () => emit("closing"),
  onClosed: () => emit("closed"),
  onOpen: () => emit("opening"),
  onOpened: () => emit("opened"),
  phase,
  setPhase,
});

const surfaceClass = computed(() =>
  cn(
    tooltipSurfaceClasses,
    opened.value && tooltipOpenedClasses,
    phase.value === "opened" && tooltipDurationClasses,
    phase.value === "closing" && tooltipDurationClasses,
    (phase.value === "closing" || !opened.value) && tooltipHiddenClasses,
    d.value.zIndex,
    tooltipOrigins[d.value.position],
    attrs.class,
  ),
);
const contentClass = computed(() => cn(tooltipContentClasses, d.value.contentClassName));

watch(
  () => d.value.anchorElement,
  (element) => {
    if (element) setAnchorElement(element);
  },
  { immediate: true },
);

provideSurfaceColorReset();
</script>

<template>
  <Teleport :to="teleportTarget">
    <div v-if="mounted" :class="containerClass">
      <Surface
        v-bind="surfaceAttrs"
        :ref="setSurface"
        :accent="currentAccent"
        :class="surfaceClass"
        :content-class-name="contentClass"
        :data-open="opened || undefined"
        :data-position="d.position"
        :level="currentSurfaceLevel"
        outline
        variant="gradient"
      >
        <slot />
      </Surface>
    </div>
  </Teleport>
</template>
