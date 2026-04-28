<script setup lang="ts">
import { computed } from "vue";
import SpotlightCard from "@/components/SpotlightCard/SpotlightCard.vue";
import type { BentoCard } from "@/data/marketing";

const props = defineProps<{
  card: BentoCard;
  active: boolean;
  size?: "compact" | "wide" | "tall";
}>();

const emit = defineEmits<{
  select: [key: string];
}>();

const selectCard = () => {
  emit("select", props.card.key);
};

const tileClass = computed(() => {
  if (props.size === "tall") {
    return "min-h-[360px]";
  }

  if (props.size === "wide") {
    return "min-h-[220px]";
  }

  return "min-h-[190px]";
});
</script>

<template>
  <button
    type="button"
    class="group h-full w-full text-left"
    @mouseenter="selectCard"
    @focus="selectCard"
    @click="selectCard"
  >
    <SpotlightCard
      class-name="h-full rounded-[14px] border p-0"
      :spotlight-color="`${card.accent}22`"
    >
      <article
        class="relative h-full overflow-hidden rounded-[14px] border bg-[#] transition duration-300"
        :class="[
          tileClass,
          active
            ? 'border-white/[0.22] bg-[#12161d]'
            : 'border-white/[0.08] hover:border-white/[0.16]',
          `bg-[${card.accent}]`,
        ]"
        :style="active ? { boxShadow: `0 24px 80px ${card.accent}22` } : undefined"
      >
        <!-- <img
          :src="card.screenshot.src"
          :alt="card.screenshot.title"
          class="absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          decoding="async"
        /> -->
        <div
          class="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,11,0.2)_0%,rgba(7,8,11,0.4)_28%,rgba(7,8,11,0.9)_100%)]"
        />
        <div
          class="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:22px_22px] opacity-40"
        />

        <div class="relative flex h-full flex-col justify-between p-4">
          <div class="flex items-start justify-between gap-3">
            <span class="text-[10px] uppercase tracking-[0.18em] text-white/[0.56]">{{
              card.label
            }}</span>
            <span
              class="inline-flex h-2.5 w-2.5 rounded-full transition"
              :style="{
                backgroundColor: active ? card.accent : 'rgba(255,255,255,0.2)',
                boxShadow: active ? `0 0 28px ${card.accent}` : undefined,
              }"
            />
          </div>

          <div class="translate-y-1 transition duration-300 group-hover:translate-y-0">
            <h3 class="max-w-[18ch] text-[18px] leading-[1.04] text-white md:text-[20px]">
              {{ card.title }}
            </h3>
            <p
              class="mt-3 max-w-[28ch] text-[13px] leading-6 text-white/[0.64]"
              :class="size === 'compact' ? 'line-clamp-2' : ''"
            >
              {{ card.body }}
            </p>

            <div class="mt-4 flex flex-wrap gap-2">
              <span
                v-for="metric in card.metrics"
                :key="metric"
                class="border border-white/[0.12] bg-black/[0.24] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-white/[0.66]"
              >
                {{ metric }}
              </span>
            </div>
          </div>
        </div>
      </article>
    </SpotlightCard>
  </button>
</template>
