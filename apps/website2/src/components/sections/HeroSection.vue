<script setup lang="ts">
import { ref } from "vue";
import BlurText from "@/components/BlurText/BlurText.vue";
import Threads from "@/components/Threads/Threads.vue";
import TextType from "@/components/TextType/TextType.vue";
import AppFrame from "@/components/ui/AppFrame.vue";
import DownloadCTA from "@/components/ui/DownloadCTA.vue";
import ScrollTiltFrame from "@/components/ui/ScrollTiltFrame.vue";
// Variant A (previous default) - a vertical attach timeline: Device -> Target -> Session.
// Swap back by uncommenting this import and the <AttachChain /> below, and removing
// the HeroTerminalFeed import/usage.
// import AttachChain from "@/components/sections/AttachChain.vue";
import HeroTerminalFeed from "@/components/sections/HeroTerminalFeed.vue";
import { useInView } from "@/composables/useInView";
import { useReducedMotion } from "@/composables/useReducedMotion";

const hero = ref<HTMLElement | null>(null);
const { reduced } = useReducedMotion();
const { inView } = useInView(hero);

const requirements = ["Android device", "USB debugging", "ADB in PATH"];
</script>

<template>
  <section id="top" ref="hero" class="relative pb-16 pt-28 md:pb-24 md:pt-32">
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden"
      aria-hidden="true"
    >
      <div
        class="absolute inset-0 bg-[radial-gradient(90%_70%_at_78%_-5%,rgba(232,118,90,0.16),transparent_62%),radial-gradient(70%_60%_at_10%_10%,rgba(113,203,255,0.07),transparent_60%)]"
      />
      <div
        class="absolute -right-24 top-[-40px] h-[520px] w-[62%] opacity-70 [mask-image:radial-gradient(70%_70%_at_60%_40%,black,transparent)]"
      >
        <Threads
          v-if="!reduced && inView"
          :color="[0.91, 0.46, 0.35]"
          :amplitude="1.4"
          :distance="0.35"
          :enable-mouse-interaction="true"
        />
      </div>
      <div
        class="absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(180deg,transparent,var(--background)_88%)]"
      />
    </div>

    <div class="relative mx-auto max-w-[1360px] px-5 md:px-8">
      <div class="grid gap-12 lg:grid-cols-[1.32fr_0.68fr] lg:items-start">
        <div class="flex flex-col items-center text-center lg:items-start lg:pt-6 lg:text-left">
          <p
            class="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--ink-2)]"
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
            class-name="mt-6 max-w-[13ch] justify-center font-[var(--font-display)] text-[44px] font-semibold leading-[0.98] tracking-[-0.035em] text-[var(--ink-0)] sm:text-[62px] lg:justify-start xl:text-[82px]"
          />

          <p
            class="mt-7 max-w-[54ch] text-[15px] font-normal leading-[1.75] text-[var(--ink-2)] md:text-[17px]"
          >
            Capubridge attaches to a real device over ADB, forwards the CDP port for you, and puts
            storage, DOM, network, logs and a live mirror of the phone in one native window.
          </p>

          <div class="mt-9 flex w-full justify-center lg:w-auto lg:justify-start">
            <DownloadCTA />
          </div>
        </div>

        <div class="lg:pt-2">
          <!-- Variant A: <AttachChain /> - a vertical attach timeline. -->
          <HeroTerminalFeed />

          <dl class="mt-2 grid grid-cols-2 gap-px border border-[var(--rule)] bg-[var(--rule)]">
            <div class="bg-[var(--background)] p-4">
              <dt class="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-3)]">
                Session
              </dt>
              <dd class="mt-2 font-mono text-[12px] text-[var(--ink-1)]">
                <TextType
                  :text="['adb attach', 'forward cdp', 'read storage', 'capture proof']"
                  :typing-speed="46"
                  :deleting-speed="24"
                  :pause-duration="1400"
                  :show-cursor="true"
                  cursor-character="_"
                  cursor-class-name="text-[var(--accent)]"
                />
              </dd>
            </div>
            <div v-for="req in requirements" :key="req" class="bg-[var(--background)] p-4">
              <dt class="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-3)]">
                Requires
              </dt>
              <dd class="mt-2 text-[13px] leading-5 text-[var(--ink-1)]">
                {{ req }}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div class="mt-16 md:mt-24">
        <ScrollTiltFrame>
          <AppFrame capture="heroOverview" ratio="16 / 9" priority>
            <template #caption>
              Hardware, a live mirror of the phone and the console drawer, all in one window.
            </template>
          </AppFrame>
        </ScrollTiltFrame>
      </div>
    </div>
  </section>
</template>
