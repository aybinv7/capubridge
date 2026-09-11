<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementReveal } from "@/composables/useElementReveal";
import { useReducedMotion } from "@/composables/useReducedMotion";

const host = ref<HTMLElement | null>(null);
const { progress } = useElementReveal(host);
const { reduced } = useReducedMotion();

const eased = computed(() => {
  const t = progress.value;
  return 1 - Math.pow(1 - t, 3);
});

const stageStyle = computed(() => {
  if (reduced.value) return undefined;
  const t = eased.value;
  return {
    transform: `translate3d(0, ${(1 - t) * 56}px, 0) scale(${0.95 + t * 0.15}) rotateX(${(1 - t) * 18}deg)`,
    opacity: String(0.18 + t * 0.82),
  };
});

const glowStyle = computed(() => ({
  opacity: String(reduced.value ? 0.35 : eased.value * 0.55),
}));
</script>

<template>
  <div ref="host" class="relative [perspective:1600px]">
    <div
      class="pointer-events-none absolute inset-x-0 -bottom-6 top-8 rounded-[2rem] bg-[radial-gradient(60%_60%_at_50%_50%,rgba(232,118,90,0.3),transparent_70%)] blur-3xl"
      :style="glowStyle"
      aria-hidden="true"
    />
    <div class="relative origin-bottom will-change-transform" :style="stageStyle">
      <slot />
    </div>
  </div>
</template>
