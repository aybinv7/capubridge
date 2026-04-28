<script setup lang="ts">
import { Motion } from "motion-v";
import { computed, ref } from "vue";
import SplitText from "@/components/SplitText/SplitText.vue";
import SurfaceBentoCard from "@/components/SurfaceBentoCard.vue";
import SurfaceBentoPreview from "@/components/SurfaceBentoPreview.vue";
import type { BentoCard } from "@/data/marketing";

const props = defineProps<{
  cards: BentoCard[];
  systemChips: string[];
  workflowChips: string[];
}>();

const activeKey = ref(props.cards[0]?.key ?? "");

const activeCard = computed(
  () => props.cards.find((card) => card.key === activeKey.value) ?? props.cards[0],
);

const leadingCards = computed(() => props.cards.slice(0, 5));
const supportCards = computed(() => props.cards.slice(5));

const selectCard = (key: string) => {
  activeKey.value = key;
};
</script>

<template>
  <section id="surfaces" class="relative overflow-hidden px-4 py-12 md:px-6 md:py-16">
    <div
      class="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(232,118,90,0.12),transparent_32%),radial-gradient(circle_at_86%_28%,rgba(113,203,255,0.1),transparent_34%),#090a0d]"
    />
    <div
      class="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-35"
    />

    <div class="relative mx-auto max-w-[1440px]">
      <div class="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">
            Interactive product map
          </p>
          <SplitText
            text="One grid. Six ways to debug."
            tag="h2"
            split-type="words"
            text-align="left"
            class-name="mt-3 font-[var(--font-display)] text-[34px] leading-[0.95] text-white md:text-[54px]"
            :delay="42"
            :duration="0.7"
            :from="{ opacity: 0, y: 24 }"
            :to="{ opacity: 1, y: 0 }"
          />
        </div>
        <p class="max-w-[360px] text-[13px] leading-6 text-white/[0.58] md:text-right">
          Hover the product surface. Evidence panel, signals, and team path follow the selected
          workflow.
        </p>
      </div>

      <div class="grid gap-3 xl:grid-cols-[1.18fr_0.82fr]">
        <Transition name="hero-mode-swap" mode="out-in">
          <SurfaceBentoPreview v-if="activeCard" :key="activeCard.key" :card="activeCard" />
        </Transition>

        <div class="grid gap-3">
          <div class="grid gap-3 md:grid-cols-2">
            <Motion
              v-for="(card, index) in leadingCards"
              :key="card.key"
              tag="div"
              :initial="{ opacity: 0, y: 18, scale: 0.98 }"
              :animate="{ opacity: 1, y: 0, scale: 1 }"
              :transition="{ duration: 0.42, delay: index * 0.04 }"
              :class="index === 1 ? 'md:row-span-2' : ''"
            >
              <SurfaceBentoCard
                :card="card"
                :active="card.key === activeKey"
                :size="index === 1 ? 'tall' : 'compact'"
                @select="selectCard"
              />
            </Motion>
          </div>

          <div class="grid gap-3 md:grid-cols-[1fr_1fr]">
            <div class="grid gap-3">
              <Motion
                v-for="(card, index) in supportCards"
                :key="card.key"
                tag="div"
                :initial="{ opacity: 0, y: 18, scale: 0.98 }"
                :animate="{ opacity: 1, y: 0, scale: 1 }"
                :transition="{ duration: 0.42, delay: 0.18 + index * 0.04 }"
              >
                <SurfaceBentoCard
                  :card="card"
                  :active="card.key === activeKey"
                  size="wide"
                  @select="selectCard"
                />
              </Motion>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
