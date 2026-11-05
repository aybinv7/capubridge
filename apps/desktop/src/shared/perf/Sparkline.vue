<script setup lang="ts">
import { computed } from "vue";
import { headroomDomain, sparklineGeometry } from "./sparkline";

const WIDTH = 100;
const HEIGHT = 32;

const props = withDefaults(
  defineProps<{
    values: readonly (number | null)[];
    domain?: readonly [number, number];
    live?: boolean;
    fill?: boolean;
  }>(),
  { domain: undefined, live: false, fill: true },
);

const geometry = computed(() =>
  sparklineGeometry(props.values, WIDTH, HEIGHT, props.domain ?? headroomDomain(props.values)),
);
const nowStyle = computed(() => {
  const last = geometry.value.last;
  if (!last) return null;
  return { left: `${(last.x / WIDTH) * 100}%`, top: `${(last.y / HEIGHT) * 100}%` };
});
</script>

<template>
  <div class="relative" aria-hidden="true">
    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="none"
      class="block size-full overflow-visible"
    >
      <path v-if="props.fill" :d="geometry.area" class="fill-current opacity-10" />
      <path
        :d="geometry.line"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <span
      v-if="props.live && nowStyle"
      class="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-live"
      :style="nowStyle"
    />
  </div>
</template>
