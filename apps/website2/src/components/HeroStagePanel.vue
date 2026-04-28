<script setup lang="ts">
import { computed, ref } from "vue";
import { Motion } from "motion-v";
import type { HeroMode } from "@/data/marketing";

const props = defineProps<{
  mode: HeroMode;
  reduceMotion: boolean;
}>();

const stageRef = ref<HTMLElement | null>(null);
const tiltX = ref(0);
const tiltY = ref(0);

const stageStyle = computed(() => ({
  transform: props.reduceMotion
    ? "perspective(1600px) rotateX(0deg) rotateY(0deg)"
    : `perspective(1600px) rotateX(${tiltX.value}deg) rotateY(${tiltY.value}deg)`,
}));

const handlePointerMove = (event: PointerEvent) => {
  if (props.reduceMotion || !stageRef.value) {
    return;
  }

  const rect = stageRef.value.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width;
  const py = (event.clientY - rect.top) / rect.height;

  tiltY.value = (px - 0.5) * -7;
  tiltX.value = (py - 0.5) * 7;
};

const handlePointerLeave = () => {
  tiltX.value = 0;
  tiltY.value = 0;
};

const overlayToneClass = (tone: HeroMode["overlays"][number]["tone"]) => {
  if (tone === "success") {
    return "border-emerald-400/[0.3] bg-emerald-400/[0.1] text-emerald-100";
  }

  if (tone === "info") {
    return "border-sky-400/[0.3] bg-sky-400/[0.1] text-sky-100";
  }

  return "border-[var(--accent)]/[0.3] bg-[var(--accent)]/[0.12] text-white";
};
</script>

<template>
  <div
    ref="stageRef"
    class="relative"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
  >
    <Transition name="hero-mode-swap" mode="out-in">
      <div :key="mode.key" class="relative" :style="stageStyle">
        <div class="relative rounded-2xl">
          <img
            :src="mode.screenshot.src"
            :alt="mode.screenshot.title"
            class="h-full rounded-xl w-full object-contain"
            loading="eager"
            decoding="async"
          />

          <Motion
            v-for="(overlay, index) in mode.overlays"
            :key="`${mode.key}-${overlay.label}`"
            tag="div"
            :initial="{ opacity: 0, y: 16, scale: 0.96 }"
            :animate="{ opacity: 1, y: 0, scale: 1 }"
            :transition="{ duration: 0.42, delay: 0.1 + index * 0.08 }"
            class="absolute border px-3 py-2 backdrop-blur-xl"
            :class="[
              overlay.position,
              overlayToneClass(overlay.tone),
              reduceMotion ? '' : 'hero-drift',
            ]"
          >
            <p class="text-[10px] uppercase tracking-[0.14em] text-white/[0.58]">
              {{ overlay.label }}
            </p>
            <p class="mt-1 text-[12px] font-semibold">{{ overlay.value }}</p>
          </Motion>
        </div>
      </div>
    </Transition>
  </div>
</template>
