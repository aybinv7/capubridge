<script setup lang="ts">
import { computed, shallowRef, useAttrs, watch } from "vue";

import { useAnchorPosition } from "../../composables/useAnchorPosition.ts";
import { useOverlayLifecycle } from "../../composables/useOverlayLifecycle.ts";
import { useOverlayPhase } from "../../composables/useOverlayPhase.ts";
import { provideSurfaceColorReset } from "../../contexts/surfaceContext.ts";
import { useUiContext } from "../../contexts/uiContext.ts";
import type { SurfaceLevelInput, UiAccent } from "../../foundations/contracts.ts";
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
  type OverlayOffsetValue,
  type TooltipPosition,
} from "./overlay.contracts.ts";

// Upstream keeps `className` (the tooltip Surface) separate from `contentClassName`.
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    accent?: UiAccent;
    anchorElement?: HTMLElement;
    color?: UiAccent;
    contentClassName?: string;
    offset?: OverlayOffsetValue;
    position?: TooltipPosition;
    root?: string | HTMLElement;
    surfaceLevel?: SurfaceLevelInput;
    zIndex?: string;
  }>(),
  {
    accent: undefined,
    anchorElement: undefined,
    color: undefined,
    contentClassName: undefined,
    offset: 4,
    position: "top",
    root: undefined,
    surfaceLevel: undefined,
    zIndex: tooltipZIndexClasses,
  },
);

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
const { phase, setPhase } = useOverlayPhase(model);

const mounted = computed(() => phase.value !== "closed");
const currentAccent = computed(() => props.color ?? props.accent);
const currentSurfaceLevel = computed(
  () => props.surfaceLevel ?? (ui.theme.value === "light" ? 1 : 5),
);
const surfaceStyle = computed(() =>
  buildTooltipPositionStyle({
    anchorName: anchorName.value,
    offset: props.offset,
    position: props.position,
  }),
);
const containerClass = tooltipContainerClasses;
const teleportTarget = computed(() => props.root ?? ui.overlaysRoot.value);
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
    props.zIndex,
    tooltipOrigins[props.position],
    attrs.class,
  ),
);
const contentClass = computed(() => cn(tooltipContentClasses, props.contentClassName));

watch(
  () => props.anchorElement,
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
        :data-cui-opened="opened || undefined"
        :data-position="props.position"
        :level="currentSurfaceLevel"
        outline
        variant="gradient"
      >
        <slot />
      </Surface>
    </div>
  </Teleport>
</template>
