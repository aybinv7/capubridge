<script setup lang="ts">
import BlurText from "@/components/BlurText/BlurText.vue";

defineProps<{
  index: string;
  eyebrow: string;
  title: string;
  lede?: string;
}>();
</script>

<template>
  <header class="border-t border-[var(--rule)] pt-6">
    <div
      class="flex flex-col items-center gap-8 text-center lg:flex-row lg:items-start lg:justify-between lg:text-left"
    >
      <div class="flex flex-col items-center gap-3 lg:flex-row lg:items-start lg:gap-6">
        <span
          class="font-mono text-[11px] tabular-nums tracking-[0.18em] text-[var(--ink-3)] lg:pt-2"
          aria-hidden="true"
        >
          {{ index }}
        </span>
        <div class="flex flex-col items-center lg:items-start">
          <p class="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
            {{ eyebrow }}
          </p>
          <BlurText
            :text="title"
            as="h2"
            animate-by="words"
            direction="top"
            :delay="70"
            class-name="mt-4 max-w-[22ch] justify-center font-[var(--font-display)] text-[30px] font-semibold leading-[1.02] tracking-[-0.02em] text-[var(--ink-0)] md:text-[44px] lg:justify-start"
          />
        </div>
      </div>

      <p
        v-if="lede"
        class="max-w-[46ch] text-[14px] font-normal leading-[1.75] text-[var(--ink-2)] lg:max-w-[38ch] lg:pt-3 lg:text-left"
      >
        {{ lede }}
      </p>
    </div>
  </header>
</template>
