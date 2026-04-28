<script setup lang="ts">
import { Motion } from "motion-v";
import SpotlightCard from "@/components/SpotlightCard/SpotlightCard.vue";
import type { BentoCard } from "@/data/marketing";

defineProps<{
  card: BentoCard;
}>();
</script>

<template>
  <SpotlightCard
    class-name="h-full rounded-[16px] border p-0"
    :spotlight-color="`${card.accent}26`"
  >
    <article
      class="relative h-full min-h-[560px] overflow-hidden rounded-[16px] border ]"
      :style="{ boxShadow: `0 36px 120px ${card.accent}1f` }"
    >
      <!-- <div
        class="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,9,12,0.08)_0%,rgba(8,9,12,0.22)_34%,rgba(8,9,12,0.94)_100%)]"
      />
      <div
        class="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:28px_28px] opacity-55"
      /> -->

      <div class="relative flex h-full flex-col justify-between p-4 md:p-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-[10px] uppercase tracking-[0.18em] text-white/[0.56]">
              {{ card.label }}
            </p>
            <p
              class="mt-3 max-w-[15ch] font-[var(--font-display)] text-[30px] leading-[0.94] text-white md:text-[56px]"
            >
              {{ card.title }}
            </p>
          </div>

          <div class="hidden flex-wrap justify-end gap-2 md:flex">
            <span
              v-for="metric in card.metrics"
              :key="metric"
              class="rounded-full border border-white/[0.12] bg-black/[0.24] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/[0.68]"
            >
              {{ metric }}
            </span>
          </div>
        </div>
        <img
          :src="card.screenshot.src"
          :alt="card.screenshot.title"
          class="h-full p-2 w-full object-cover object-top transition duration-500"
          loading="eager"
          decoding="async"
        />
        <Motion
          tag="div"
          :initial="{ opacity: 0, y: 18 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.42 }"
          class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-end"
        >
          <p class="max-w-[34ch] text-[14px] leading-7 text-white/[0.7] md:text-[15px]">
            {{ card.body }}
          </p>

          <div class="grid gap-3 border-l border-white/[0.12] pl-4">
            <div class="flex items-center gap-2">
              <span
                class="h-2.5 w-2.5 rounded-full"
                :style="{
                  backgroundColor: card.accent,
                  boxShadow: `0 0 28px ${card.accent}`,
                }"
              />
              <span class="text-[11px] uppercase tracking-[0.16em] text-white/[0.5]"
                >Evidence focus</span
              >
            </div>
            <p class="text-[13px] leading-6 text-white/[0.68]">
              {{ card.screenshot.caption }}
            </p>
          </div>
        </Motion>
      </div>
    </article>
  </SpotlightCard>
</template>
