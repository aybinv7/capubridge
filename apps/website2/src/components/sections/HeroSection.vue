<script setup lang="ts">
import { ref } from "vue";
import BlurText from "@/components/BlurText/BlurText.vue";
import Threads from "@/components/Threads/Threads.vue";
import AppFrame from "@/components/ui/AppFrame.vue";
import DownloadCTA from "@/components/ui/DownloadCTA.vue";
import ScrollTiltFrame from "@/components/ui/ScrollTiltFrame.vue";
// Right-column variants, all kept on disk for when the hero splits again:
//   import AttachChain from "@/components/sections/AttachChain.vue";
//   import HeroTerminalFeed from "@/components/sections/HeroTerminalFeed.vue";
//   import HeroClipFrame from "@/components/sections/HeroClipFrame.vue";
import { useInView } from "@/composables/useInView";
import { useReducedMotion } from "@/composables/useReducedMotion";

const hero = ref<HTMLElement | null>(null);
const { reduced } = useReducedMotion();
const { inView } = useInView(hero);
</script>

<template>
  <section id="top" ref="hero" class="relative pb-16 pt-28 md:pb-24 md:pt-32">
    <!--
      Symmetric ambience: with the column centred, a right-biased glow and a
      right-hand thread field would read as an accident. The strands sit high
      and fade out above the headline so they never fight the type.
    -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-[1080px] overflow-hidden"
      aria-hidden="true"
    >
      <div
        class="absolute inset-0 bg-[radial-gradient(80%_62%_at_50%_-8%,rgba(232,118,90,0.16),transparent_62%),radial-gradient(60%_50%_at_50%_16%,rgba(113,203,255,0.06),transparent_62%)]"
      />
      <div
        class="absolute left-1/2 top-[-10px] h-[720px] w-[min(1600px,155%)] -translate-x-1/2 opacity-60 [mask-image:radial-gradient(62%_68%_at_50%_38%,black,transparent_74%)]"
      >
        <Threads
          v-if="!reduced && inView"
          :color="[0.91, 0.46, 0.35]"
          :amplitude="1.4"
          :distance="0.35"
          :enable-mouse-interaction="true"
        />
      </div>
      <!--
        A long dissolve rather than a short one. The ambient layer is clipped
        at a fixed height, so if it still has colour where it ends you get a
        hard horizontal seam across the page at that exact pixel.
      -->
      <div
        class="absolute inset-x-0 bottom-0 h-[520px] bg-[linear-gradient(180deg,transparent,var(--background)_62%,var(--background))]"
      />
    </div>

    <div class="relative mx-auto max-w-[1360px] px-5 md:px-8">
      <div class="flex flex-col items-center text-center">
        <p
          class="flex items-center justify-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--ink-2)]"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
          Android WebView workbench
        </p>

        <BlurText
          as="h1"
          text="See inside any Android WebView."
          animate-by="words"
          direction="top"
          :delay="90"
          class-name="mt-6 max-w-[14ch] justify-center font-[var(--font-display)] text-[44px] font-semibold leading-[0.98] tracking-[-0.035em] text-[var(--ink-0)] sm:text-[62px] xl:text-[82px]"
        />

        <p
          class="mt-7 max-w-[56ch] text-[15px] font-normal leading-[1.75] text-[var(--ink-2)] md:text-[17px]"
        >
          Capubridge attaches to a real device over ADB, forwards the CDP port for you, and puts
          storage, DOM, network, logs and a live mirror of the phone in one native window.
        </p>

        <div class="mt-9 flex justify-center">
          <DownloadCTA />
        </div>
      </div>

      <!--
        Bounded by viewport height, not container width. At full width the
        frame came out 16:9 of 1296px - 802px tall, 89% of a 900px viewport -
        so the reveal could never be seen whole. Height drives the size now
        and the width follows the ratio.
      -->
      <div class="mt-12 md:mt-16">
        <ScrollTiltFrame>
          <div class="mx-auto" style="max-width: min(100%, calc(78svh * 16 / 9))">
            <AppFrame capture="heroOverview" ratio="16 / 9" priority>
              <template #caption>
                Hardware, a live mirror of the phone and the console drawer, all in one window.
              </template>
            </AppFrame>
          </div>
        </ScrollTiltFrame>
      </div>
    </div>
  </section>
</template>
