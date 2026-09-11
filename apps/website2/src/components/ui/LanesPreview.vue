<script setup lang="ts">
/** Deterministic tick positions so the lanes read as captured data, not noise. */
const lanes = [
  { name: "DOM replay", accent: "#8f86ff", ticks: [4, 11, 18, 26, 33, 41, 52, 63, 71, 84, 92] },
  { name: "Network", accent: "#71cbff", ticks: [9, 14, 15, 28, 44, 45, 46, 67, 79, 88] },
  { name: "Console", accent: "#f0c36b", ticks: [12, 31, 47, 48, 70, 91] },
  { name: "DB changes", accent: "#5ad39a", ticks: [16, 29, 45, 58, 76, 90] },
  { name: "Performance", accent: "#e8765a", ticks: [6, 20, 34, 49, 61, 73, 86, 96] },
];

const playhead = 58;
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-[var(--rule-strong)] bg-[var(--surface-0)]">
    <div
      class="flex items-center justify-between border-b border-[var(--rule)] bg-[var(--surface-2)] px-3 py-2"
    >
      <span class="font-mono text-[10px] tracking-[0.1em] text-[var(--ink-3)]">
        session · 00:50.975
      </span>
      <span class="font-mono text-[10px] text-[var(--ink-3)]">5 tracks</span>
    </div>

    <div class="relative space-y-2.5 px-3 py-4">
      <div v-for="lane in lanes" :key="lane.name" class="flex items-center gap-3">
        <span class="w-[5.5rem] shrink-0 font-mono text-[10px] text-[var(--ink-3)]">
          {{ lane.name }}
        </span>
        <span class="relative h-4 flex-1 rounded-sm bg-[var(--surface-2)]">
          <span
            v-for="tick in lane.ticks"
            :key="tick"
            class="absolute top-1 h-2 w-px"
            :style="{ left: `${tick}%`, background: lane.accent }"
          />
        </span>
      </div>

      <span
        class="pointer-events-none absolute inset-y-2 w-px bg-[var(--ink-1)]"
        :style="{ left: `calc(5.5rem + 0.75rem + ${playhead}% * 0.72)` }"
        aria-hidden="true"
      />
    </div>
  </div>
</template>
