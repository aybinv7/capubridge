<script setup lang="ts">
import { computed } from "vue";
import { useScrollProgress } from "@/composables/useScrollProgress";

const { progress } = useScrollProgress();

const lineStyle = computed(() => ({ transform: `scaleY(${Math.max(0.001, progress.value)})` }));
const headStyle = computed(() => ({ top: `${progress.value * 100}%` }));
</script>

<template>
  <div
    class="pointer-events-none fixed right-0 top-0 z-[1150] hidden h-full w-px md:block"
    aria-hidden="true"
  >
    <div class="absolute inset-0 bg-[var(--rule)]" />
    <div
      class="absolute inset-x-0 top-0 h-full origin-top bg-[linear-gradient(180deg,transparent,var(--accent))]"
      :style="lineStyle"
    />
    <div
      class="absolute right-0 h-6 w-px -translate-y-1/2 bg-[var(--accent)] shadow-[0_0_12px_2px_rgba(232,118,90,0.55)]"
      :style="headStyle"
    />
  </div>
</template>
