<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const links = [
  {
    label: "Device",
    value: "arm64 · USB",
    detail: "adb picks it up",
    accent: "#e8765a",
  },
  {
    label: "Target",
    value: "https://localhost",
    detail: "port forwarded",
    accent: "#71cbff",
  },
  {
    label: "Session",
    value: "storage · dom · net · logs",
    detail: "one window",
    accent: "#5ad39a",
  },
];

const drawn = ref<boolean[]>(links.map(() => false));
const timers: number[] = [];

onMounted(() => {
  links.forEach((_, index) => {
    timers.push(
      window.setTimeout(
        () => {
          drawn.value[index] = true;
        },
        420 + index * 260,
      ),
    );
  });
});

onBeforeUnmount(() => {
  for (const timer of timers) window.clearTimeout(timer);
});
</script>

<template>
  <ol class="relative flex flex-col gap-0">
    <li
      v-for="(link, index) in links"
      :key="link.label"
      class="filament-host relative pl-7"
      :style="{ '--card-accent': link.accent }"
      :data-drawn="drawn[index] ? 'true' : 'false'"
    >
      <span
        class="absolute left-0 top-[7px] h-[7px] w-[7px] rounded-full transition-opacity duration-500"
        :style="{
          background: link.accent,
          boxShadow: `0 0 14px ${link.accent}`,
          opacity: drawn[index] ? '1' : '0.25',
        }"
        aria-hidden="true"
      />

      <svg
        v-if="index < links.length - 1"
        class="pointer-events-none absolute left-[3px] top-[14px] h-[calc(100%-14px)] w-px overflow-visible"
        aria-hidden="true"
      >
        <line
          class="filament"
          style="--filament-length: 100"
          x1="0"
          y1="0"
          x2="0"
          y2="100%"
          pathLength="100"
        />
      </svg>

      <div class="pb-6">
        <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-3)]">
          {{ link.label }}
        </p>
        <p class="mt-1.5 font-mono text-[12px] text-[var(--ink-0)]">{{ link.value }}</p>
        <p class="mt-1 text-[11px] text-[var(--ink-3)]">{{ link.detail }}</p>
      </div>
    </li>
  </ol>
</template>
