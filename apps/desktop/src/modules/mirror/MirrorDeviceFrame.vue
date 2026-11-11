<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementSize } from "@vueuse/core";
import { fitDeviceFrame } from "./deviceFrame";

const props = withDefaults(
  defineProps<{ deviceWidth: number; deviceHeight: number; bare?: boolean }>(),
  { bare: false },
);

const well = ref<HTMLElement | null>(null);
const screen = ref<HTMLElement | null>(null);
const { width: areaWidth, height: areaHeight } = useElementSize(well);

const frame = computed(() =>
  fitDeviceFrame({
    areaWidth: areaWidth.value,
    areaHeight: areaHeight.value,
    deviceWidth: props.deviceWidth,
    deviceHeight: props.deviceHeight,
    bare: props.bare,
  }),
);

/** The room inside the well, which a Responsive page fills at 100%. */
const area = computed(() => ({ width: areaWidth.value, height: areaHeight.value }));

const bezelStyle = computed(() => ({
  width: `${frame.value.width}px`,
  height: `${frame.value.height}px`,
  padding: `${frame.value.bezel}px`,
  borderRadius: `${frame.value.outerRadius}px`,
}));

const screenStyle = computed(() => ({ borderRadius: `${frame.value.innerRadius}px` }));

defineExpose({ well, screen, frame, area });
</script>

<template>
  <div
    ref="well"
    class="relative mx-2 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-well bg-surface-cut p-2 shadow-cut"
  >
    <div
      v-if="$slots.overlay"
      class="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3"
    >
      <slot name="overlay" />
    </div>
    <div
      v-show="frame.width > 0"
      class="shrink-0"
      :class="
        props.bare ? 'bg-surface-0 ring-1 ring-border-subtle' : 'bg-black ring-1 ring-white/10'
      "
      :style="bezelStyle"
      :data-orientation="frame.orientation"
    >
      <div
        ref="screen"
        class="relative flex h-full w-full items-center overflow-hidden bg-black"
        :style="screenStyle"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
