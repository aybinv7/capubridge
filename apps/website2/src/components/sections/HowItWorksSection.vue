<script setup lang="ts">
import RevealOnScroll from "@/components/ui/RevealOnScroll.vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import LayeredCard from "@/components/ui/LayeredCard.vue";
import { steps } from "@/data/steps";
</script>

<template>
  <section
    id="how"
    class="pattern-rings relative mx-auto max-w-[1360px] scroll-mt-20 px-5 py-16 md:px-8 md:py-24"
  >
    <SectionHeader
      index="02"
      eyebrow="How it works"
      title="Three steps, then you are already inside."
      lede=""
    />

    <ol class="mt-14 grid gap-6 md:grid-cols-3 md:gap-8">
      <RevealOnScroll
        v-for="(step, index) in steps"
        :key="step.index"
        as="li"
        :delay="index * 90"
        :distance="20"
      >
        <LayeredCard :accent="step.accent" class="h-full">
          <div
            class="step-face flex h-full flex-col gap-4 rounded-lg border border-[var(--rule)] bg-[var(--surface-0)] p-7 md:p-8"
          >
            <span
              class="step-index font-[var(--font-display)] text-[38px] font-semibold leading-none tracking-[-0.04em]"
              aria-hidden="true"
            >
              {{ step.index }}
            </span>
            <h3 class="text-[18px] font-semibold tracking-[-0.01em] text-[var(--ink-0)]">
              {{ step.title }}
            </h3>
            <p class="text-[14px] font-normal leading-[1.7] text-[var(--ink-2)]">
              {{ step.description }}
            </p>
            <p
              class="mt-auto border-t border-[var(--rule)] pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]"
            >
              {{ step.detail }}
            </p>
          </div>
        </LayeredCard>
      </RevealOnScroll>
    </ol>
  </section>
</template>

<style scoped>
.step-face {
  transition:
    border-color 260ms ease,
    background-color 260ms ease;
}

.layered:hover .step-face {
  border-color: color-mix(in srgb, var(--card-accent) 45%, transparent);
  background-color: var(--surface-1);
}

.step-index {
  color: var(--rule-strong);
  transition: color 300ms ease;
}

.layered:hover .step-index {
  color: var(--card-accent);
}
</style>
