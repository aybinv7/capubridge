<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { ChevronDown, Circle, Signal, Cpu } from "lucide-vue-next";

const clock = ref("");

function updateClock() {
  const now = new Date();
  clock.value = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

let timer: ReturnType<typeof setInterval>;
onMounted(() => {
  updateClock();
  timer = setInterval(updateClock, 1000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <header class="h-10 bg-surface-0 flex items-center px-4 gap-5 shrink-0">
    <!-- Device selector -->
    <button
      class="flex items-center gap-2 text-xs surface-interactive rounded-md px-2.5 py-1.5 border border-transparent hover:border-border/40"
    >
      <Circle class="w-[7px] h-[7px] fill-success text-success glow-dot" />
      <span class="font-medium text-foreground">Galaxy S23</span>
      <span class="text-muted-foreground">R5CR30LHXXY</span>
      <ChevronDown class="w-3 h-3 text-muted-foreground" />
    </button>

    <div class="w-px h-4 bg-border/40" />

    <!-- CDP target -->
    <div class="flex items-center gap-2 text-xs">
      <Signal class="w-3 h-3 text-primary" />
      <span class="text-secondary-foreground">CDP</span>
      <span class="text-muted-foreground font-mono text-2xs">localhost:9222</span>
    </div>

    <div class="w-px h-4 bg-border/40" />

    <!-- Origin -->
    <div class="flex items-center gap-2 text-xs">
      <Cpu class="w-3 h-3 text-muted-foreground" />
      <span class="font-mono text-secondary-foreground text-2xs">my-ionic-app.com</span>
    </div>

    <div class="flex-1" />

    <!-- Clock + shortcut -->
    <div class="flex items-center gap-3 text-2xs text-muted-foreground">
      <span class="font-mono">{{ clock }}</span>
      <kbd
        class="px-1.5 py-0.5 rounded bg-surface-3 border border-border/40 text-2xs text-muted-foreground"
        >⌘K</kbd
      >
    </div>
  </header>
</template>
