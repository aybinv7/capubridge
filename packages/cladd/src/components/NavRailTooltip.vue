<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import { useAnchorPosition } from '../composables/useAnchorPosition.ts';
import { useOverlayLifecycle } from '../composables/useOverlayLifecycle.ts';
import { useOverlayPhase } from '../composables/useOverlayPhase.ts';
import { provideSurfaceColorReset } from '../contexts/surfaceContext.ts';
import { useUiContext } from '../contexts/uiContext.ts';
import { cn } from '../shared/cn.ts';
import {
  buildNavRailTooltipStyle,
  navRailTooltipContentClasses,
  navRailTooltipOriginClasses,
} from './navRailTooltip.ts';
import {
  resolveOverlayElement,
  tooltipContainerClasses,
  tooltipContentClasses,
  tooltipDurationClasses,
  tooltipHiddenClasses,
  tooltipOpenedClasses,
  tooltipSurfaceClasses,
  tooltipZIndexClasses,
} from './overlay.contracts.ts';
import Surface from './Surface.vue';

const props = defineProps<{
  anchorElement?: HTMLElement;
}>();

defineSlots<{
  default?: () => unknown;
}>();

const model = defineModel<boolean>('open', { default: false });
const ui = useUiContext();
const surface = shallowRef<HTMLElement>();
const { anchorName, setAnchorElement } = useAnchorPosition();
const { phase, setPhase } = useOverlayPhase(model);
const mounted = computed(() => phase.value !== 'closed');
const surfaceLevel = computed(() => (ui.theme.value === 'light' ? 1 : 5));
const surfaceStyle = computed(() => buildNavRailTooltipStyle(anchorName.value));

function setSurface(value: unknown): void {
  surface.value = resolveOverlayElement(value);
}

const { opened } = useOverlayLifecycle({ element: surface, phase, setPhase });

const surfaceClass = computed(() =>
  cn(
    tooltipSurfaceClasses,
    opened.value && tooltipOpenedClasses,
    (phase.value === 'opened' || phase.value === 'closing') &&
      tooltipDurationClasses,
    (phase.value === 'closing' || !opened.value) && tooltipHiddenClasses,
    tooltipZIndexClasses,
    navRailTooltipOriginClasses,
  ),
);
const contentClass = cn(tooltipContentClasses, navRailTooltipContentClasses);

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
  <Teleport :to="ui.overlaysRoot.value">
    <div
      v-if="mounted"
      :class="[tooltipContainerClasses, 'cladd-nav-rail-tooltip']"
    >
      <Surface
        :ref="setSurface"
        aria-hidden="true"
        :class="surfaceClass"
        :content-class-name="contentClass"
        :data-open="opened || undefined"
        data-position="right"
        :level="surfaceLevel"
        :style="surfaceStyle"
        outline
        variant="gradient"
      >
        <slot />
      </Surface>
    </div>
  </Teleport>
</template>
