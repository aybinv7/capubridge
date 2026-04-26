<script setup lang="ts">
import { ref, computed } from "vue";
import { Play, Pause, SkipBack, SkipForward } from "lucide-vue-next";
import type { TimelineClock } from "@/composables/useTimelineClock";
import type { NetworkCapuEvent, ConsoleCapuEvent } from "@/types/replay.types";

const props = defineProps<{
  clock: TimelineClock;
  networkEvents: NetworkCapuEvent[];
  consoleEvents: ConsoleCapuEvent[];
}>();

const emit = defineEmits<{
  seek: [ms: number];
  play: [];
  pause: [];
}>();

const scrubberRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);

function formatTime(ms: number): string {
  const totalS = Math.floor(ms / 1000);
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  const msPart = Math.floor(ms % 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(msPart).padStart(3, "0")}`;
}

const progressPercent = computed(() => props.clock.progress.value * 100);

const networkMarkers = computed(() =>
  props.networkEvents.map((ev) => ({
    pct: props.clock.durationMs.value > 0 ? (ev.t / props.clock.durationMs.value) * 100 : 0,
  })),
);

const consoleErrorMarkers = computed(() =>
  props.consoleEvents
    .filter((ev) => ev.data.level === "error")
    .map((ev) => ({
      pct: props.clock.durationMs.value > 0 ? (ev.t / props.clock.durationMs.value) * 100 : 0,
    })),
);

function scrubFromEvent(e: MouseEvent) {
  if (!scrubberRef.value) return;
  const rect = scrubberRef.value.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const ms = Math.round(pct * props.clock.durationMs.value);
  props.clock.seek(ms);
  emit("seek", ms);
}

function onScrubberMouseDown(e: MouseEvent) {
  isDragging.value = true;
  scrubFromEvent(e);
  window.addEventListener("mousemove", onScrubberMouseMove);
  window.addEventListener("mouseup", onScrubberMouseUp);
}

function onScrubberMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;
  scrubFromEvent(e);
}

function onScrubberMouseUp() {
  isDragging.value = false;
  window.removeEventListener("mousemove", onScrubberMouseMove);
  window.removeEventListener("mouseup", onScrubberMouseUp);
}

function togglePlay() {
  if (props.clock.isPlaying.value) {
    props.clock.pause();
    emit("pause");
  } else {
    props.clock.play();
    emit("play");
  }
}

function skipBack() {
  const ms = Math.max(0, props.clock.positionMs.value - 5000);
  props.clock.seek(ms);
  emit("seek", ms);
}

function skipForward() {
  const ms = Math.min(props.clock.durationMs.value, props.clock.positionMs.value + 5000);
  props.clock.seek(ms);
  emit("seek", ms);
}
</script>

<template>
  <div class="flex flex-col gap-2 px-4 py-3 border-t border-border/20 bg-background select-none">
    <div
      ref="scrubberRef"
      class="relative h-6 flex items-center cursor-pointer group"
      @mousedown="onScrubberMouseDown"
    >
      <div class="absolute inset-x-0 h-1.5 rounded-full bg-surface-2">
        <div
          class="absolute left-0 top-0 h-full rounded-full bg-accent transition-none"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <div
        v-for="(marker, i) in networkMarkers"
        :key="`net-${i}`"
        class="absolute top-1/2 -translate-y-1/2 w-0.5 h-2 rounded-full bg-sky-400/60 pointer-events-none"
        :style="{ left: `${marker.pct}%` }"
      />

      <div
        v-for="(marker, i) in consoleErrorMarkers"
        :key="`err-${i}`"
        class="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full bg-red-400/80 pointer-events-none"
        :style="{ left: `${marker.pct}%` }"
      />

      <div
        class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-accent shadow-md -translate-x-1/2 transition-none group-hover:scale-110"
        :style="{ left: `${progressPercent}%` }"
      />
    </div>

    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1">
        <button
          class="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-surface-2 transition-colors"
          title="Back 5s"
          @click="skipBack"
        >
          <SkipBack class="w-3.5 h-3.5" />
        </button>
        <button
          class="w-8 h-8 flex items-center justify-center rounded-md bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
          :title="clock.isPlaying.value ? 'Pause' : 'Play'"
          @click="togglePlay"
        >
          <Pause v-if="clock.isPlaying.value" class="w-3.5 h-3.5" />
          <Play v-else class="w-3.5 h-3.5" />
        </button>
        <button
          class="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-surface-2 transition-colors"
          title="Forward 5s"
          @click="skipForward"
        >
          <SkipForward class="w-3.5 h-3.5" />
        </button>
      </div>

      <span class="font-mono text-[11px] text-muted-foreground tabular-nums">
        {{ formatTime(clock.positionMs.value) }}
        <span class="text-muted-foreground/40">/ {{ formatTime(clock.durationMs.value) }}</span>
      </span>

      <div class="flex-1" />

      <div class="flex items-center gap-3 text-[11px] text-muted-foreground/50">
        <span class="flex items-center gap-1">
          <span class="w-2 h-1 rounded bg-sky-400/60 inline-block" />
          Network
        </span>
        <span class="flex items-center gap-1">
          <span class="w-2 h-1.5 rounded bg-red-400/80 inline-block" />
          Errors
        </span>
      </div>
    </div>
  </div>
</template>
