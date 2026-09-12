<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementReveal } from "@/composables/useElementReveal";
import { useHeavyEffects } from "@/composables/useHeavyEffects";
import { useReducedMotion } from "@/composables/useReducedMotion";

const host = ref<HTMLElement | null>(null);
const { progress } = useElementReveal(host);
const { heavyEffectsAllowed } = useHeavyEffects();
const { reduced } = useReducedMotion();

const eased = computed(() => {
  const t = progress.value;
  return 1 - Math.pow(1 - t, 3);
});

/**
 * The tilt animates scale and rotateX across a box holding a full-width
 * screenshot. On a phone that is a large promoted layer being re-composited
 * against every scroll frame, so below the gate the reveal keeps only the
 * translate and the fade - both of which the compositor does for free.
 */
const stageStyle = computed(() => {
  if (reduced.value) return undefined;
  const t = eased.value;
  const opacity = String(0.18 + t * 0.82);

  if (!heavyEffectsAllowed.value) {
    return { transform: `translate3d(0, ${(1 - t) * 28}px, 0)`, opacity };
  }

  return {
    transform: `translate3d(0, ${(1 - t) * 64}px, 0) scale(${0.94 + t * 0.06}) rotateX(${(1 - t) * 24}deg)`,
    opacity,
  };
});

const glowStyle = computed(() => ({
  opacity: String(reduced.value ? 0.35 : eased.value * 0.55),
}));
</script>

<template>
  <!-- Tighter perspective than the usual 1600px so the tilt actually reads. -->
  <div ref="host" class="relative [perspective:1100px]">
    <div
      class="pointer-events-none absolute inset-x-0 -bottom-6 top-8 rounded-[2rem] bg-[radial-gradient(60%_60%_at_50%_50%,rgba(232,118,90,0.3),transparent_70%)] blur-3xl"
      :style="glowStyle"
      aria-hidden="true"
    />
    <div class="stage relative origin-bottom will-change-transform" :style="stageStyle">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/*
 * The cast shadow is what sells the tilt as depth rather than a skew. It has
 * to land on the framed box itself - not this wrapper, which also contains
 * the caption - so it follows the frame's rounded corners.
 */
.stage :deep(figure > div:first-of-type) {
  box-shadow:
    0 48px 96px -32px rgb(0 0 0 / 0.85),
    0 18px 40px -18px rgb(0 0 0 / 0.65),
    0 2px 8px -4px rgb(0 0 0 / 0.5);
}
</style>
