<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import BlurText from "@/components/BlurText/BlurText.vue";
import Grainient from "@/components/Grainient/Grainient.vue";
import HeroModeTabs from "@/components/HeroModeTabs.vue";
import HeroStagePanel from "@/components/HeroStagePanel.vue";
import TextType from "@/components/TextType/TextType.vue";
import type { HeroMode } from "@/data/marketing";

const props = defineProps<{
  modes: HeroMode[];
}>();

const reduceMotion = ref(false);
const activeModeKey = ref(props.modes[0]?.key ?? "");
let mediaQuery: MediaQueryList | undefined;
let cycleTimer: number | undefined;

const activeMode = computed(
  () => props.modes.find((mode) => mode.key === activeModeKey.value) ?? props.modes[0],
);

const setMotionPreference = () => {
  reduceMotion.value = Boolean(mediaQuery?.matches);
};

const clearCycle = () => {
  if (cycleTimer !== undefined) {
    window.clearInterval(cycleTimer);
    cycleTimer = undefined;
  }
};

const startCycle = () => {
  clearCycle();

  if (reduceMotion.value || props.modes.length < 2) {
    return;
  }

  cycleTimer = window.setInterval(() => {
    const currentIndex = props.modes.findIndex((mode) => mode.key === activeModeKey.value);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % props.modes.length : 0;
    activeModeKey.value = props.modes[nextIndex].key;
  }, 5200);
};

const selectMode = (key: string) => {
  activeModeKey.value = key;
  startCycle();
};

onMounted(() => {
  mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  setMotionPreference();
  mediaQuery.addEventListener("change", setMotionPreference);
  startCycle();
});

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener("change", setMotionPreference);
  clearCycle();
});
</script>

<template>
  <section
    class="relative h-[100svh] min-h-[680px] overflow-hidden px-3 pb-3 pt-[4.25rem] md:min-h-[760px] md:px-5 md:pb-5 md:pt-[4.6rem]"
  >
    <div
      class="absolute inset-0 bg-[linear-gradient(180deg,#09090b_0%,#0b0f14_45%,#09090b_100%)]"
    />
    <div class="absolute inset-0 opacity-[0.92]">
      <Grainient
        v-if="!reduceMotion"
        class-name="h-full w-full"
        color1="#e8765a"
        color2="#10263b"
        color3="#f2efe9"
        :time-speed="0.16"
        :color-balance="-0.12"
        :warp-strength="0.9"
        :warp-frequency="4.4"
        :warp-speed="1.8"
        :warp-amplitude="42"
        :blend-angle="-14"
        :blend-softness="0.18"
        :rotation-amount="160"
        :noise-scale="1.2"
        :grain-amount="0.08"
        :grain-scale="1.6"
        :grain-animated="false"
        :contrast="1.18"
        :gamma="1"
        :saturation="0.8"
        :center-x="0.1"
        :center-y="0"
        :zoom="0.9"
      />
    </div>
    <div
      class="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,11,0.92)_0%,rgba(9,9,11,0.62)_34%,rgba(9,9,11,0.18)_62%,rgba(9,9,11,0.54)_100%)]"
    />
    <div
      class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:46px_46px]"
    />
    <div
      class="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,rgba(9,9,11,0.96))]"
    />

    <div class="relative z-10 mx-auto grid h-full max-w-[1440px] grid-rows-[auto_1fr_auto] gap-3">
      <div class="flex items-center justify-between gap-3">
        <div
          class="flex items-center gap-2 rounded-full border border-white/[0.1] bg-black/[0.22] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/[0.54] backdrop-blur-xl"
        >
          <span
            class="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_22px_rgba(232,118,90,0.8)]"
          />
          Live Android runtime workbench
        </div>
        <HeroModeTabs :modes="modes" :active-key="activeModeKey" @select="selectMode" />
      </div>

      <div class="grid min-h-0 items-center gap-5 xl:grid-cols-[0.48fr_1.52fr]">
        <div class="relative z-20">
          <h1 class="sr-only">Capubridge turns Android WebView debugging into team evidence.</h1>
          <BlurText
            text="Debug Android WebViews like never before."
            animate-by="words"
            direction="top"
            :delay="105"
            class-name="font-[var(--font-display)] text-[44px] leading-[0.88] text-white md:text-[66px] xl:text-[84px]"
          />

          <Transition name="hero-copy-swap" mode="out-in">
            <div v-if="activeMode" :key="activeMode.key" class="mt-5">
              <p class="text-[14px] leading-7 text-white/[0.7] md:text-[16px]">
                {{ activeMode.summary }}
              </p>
            </div>
          </Transition>

          <div class="mt-5 min-h-7 text-[12px] uppercase tracking-[0.18em] text-white/[0.42]">
            <TextType
              :text="['Attach device', 'Inspect target', 'Trace storage', 'Ship evidence']"
              :typing-speed="42"
              :deleting-speed="22"
              :pause-duration="1100"
              :show-cursor="true"
              cursor-character="_"
              cursor-class-name="text-[var(--accent)]"
            />
          </div>
        </div>

        <div class="relative min-h-0">
          <div
            class="absolute -inset-8 bg-[radial-gradient(circle_at_65%_50%,rgba(232,118,90,0.2),transparent_34%),radial-gradient(circle_at_25%_58%,rgba(113,203,255,0.12),transparent_30%)] blur-2xl"
          />
          <HeroStagePanel
            v-if="activeMode"
            :mode="activeMode"
            :reduce-motion="reduceMotion"
            class="relative w-full"
          />
        </div>
      </div>
    </div>
  </section>
</template>
