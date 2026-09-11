<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useReducedMotion } from "@/composables/useReducedMotion";

const lines = [
  { cmd: "adb devices", out: "1 device attached · Xiaomi 24117RN76G", accent: "#e8765a" },
  { cmd: "cdp forward --auto", out: "127.0.0.1:54211 → target ready", accent: "#71cbff" },
  { cmd: "session open", out: "storage · dom · network · logcat", accent: "#5ad39a" },
];

const { reduced } = useReducedMotion();
const shown = ref(0);
const fading = ref(false);
const timers: number[] = [];

const clearTimers = () => {
  for (const timer of timers) window.clearTimeout(timer);
  timers.length = 0;
};

const runCycle = () => {
  clearTimers();
  fading.value = false;
  shown.value = 0;

  lines.forEach((_, index) => {
    timers.push(
      window.setTimeout(
        () => {
          shown.value = index + 1;
        },
        360 + index * 620,
      ),
    );
  });

  if (reduced.value) return;

  const holdUntil = 360 + lines.length * 620 + 1500;
  timers.push(
    window.setTimeout(() => {
      fading.value = true;
    }, holdUntil),
  );
  timers.push(
    window.setTimeout(() => {
      runCycle();
    }, holdUntil + 420),
  );
};

onMounted(() => {
  if (reduced.value) {
    shown.value = lines.length;
    return;
  }
  runCycle();
});

onBeforeUnmount(clearTimers);
</script>

<template>
  <div class="terminal-feed overflow-hidden rounded-lg border border-[var(--rule-strong)]">
    <div
      class="flex h-7 items-center gap-1.5 border-b border-[var(--rule)] bg-[var(--surface-2)] px-3"
    >
      <span class="h-2 w-2 rounded-full bg-white/15" />
      <span class="h-2 w-2 rounded-full bg-white/10" />
      <span class="h-2 w-2 rounded-full bg-white/10" />
      <span class="ml-2 font-mono text-[10px] tracking-[0.1em] text-[var(--ink-3)]">
        session.log
      </span>
    </div>

    <div
      class="feed-body flex flex-col gap-3 bg-[var(--surface-0)] p-4 font-mono text-[12px] transition-opacity duration-300"
      :class="fading ? 'opacity-0' : 'opacity-100'"
    >
      <!--
        Both lines of every row are always in the DOM, at a fixed row
        height, and only fade with opacity - so the card's final height is
        known on first paint and never reflows as lines "appear".
      -->
      <div v-for="(line, index) in lines" :key="line.cmd" class="row-fixed">
        <p
          class="flex items-center gap-2 text-[var(--ink-2)] transition-opacity duration-300"
          :class="shown > index ? 'opacity-100' : 'opacity-0'"
        >
          <span class="text-[var(--ink-3)]">$</span>
          {{ line.cmd }}
          <span
            v-if="shown === index + 1"
            class="inline-block h-3.5 w-[7px] animate-pulse bg-[var(--ink-3)]"
            aria-hidden="true"
          />
        </p>
        <p
          class="mt-1 pl-4 transition-opacity duration-300"
          :class="shown > index ? 'opacity-100' : 'opacity-0'"
          :style="{ color: line.accent }"
        >
          {{ line.out }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.terminal-feed {
  box-shadow: 0 20px 60px -30px rgba(0, 0, 0, 0.6);
}

.row-fixed {
  height: 3.75rem;
}
</style>
