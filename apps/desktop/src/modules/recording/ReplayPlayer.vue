<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Replayer } from "rrweb";
import type { eventWithTime } from "@rrweb/types";
import type { RrwebCapuEvent } from "@/types/replay.types";

const props = defineProps<{
  events: RrwebCapuEvent[];
}>();

const containerRef = ref<HTMLElement | null>(null);
let replayer: Replayer | null = null;

onMounted(() => {
  if (!containerRef.value || props.events.length === 0) return;

  const rawEvents = props.events.map((e) => e.data) as eventWithTime[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = { root: containerRef.value, skipInactive: true, speed: 1, mouseTail: false };
  replayer = new Replayer(rawEvents, config);
  replayer.pause(0);
});

onUnmounted(() => {
  replayer?.destroy();
  replayer = null;
});

/** Seek to a time offset (ms from session start) without playing */
function seekTo(ms: number) {
  replayer?.pause(ms);
}

/** Start playback from the given offset (ms). Omit to resume. */
function play(fromMs?: number) {
  if (fromMs !== undefined) {
    replayer?.play(fromMs);
  } else {
    replayer?.play();
  }
}

/** Pause playback. Optionally snap to a position. */
function pause(atMs?: number) {
  replayer?.pause(atMs);
}

defineExpose({ seekTo, play, pause });
</script>

<template>
  <div class="relative w-full h-full overflow-hidden bg-black rounded-md">
    <!-- rrweb mounts an iframe inside this container -->
    <div ref="containerRef" class="absolute inset-0 flex items-center justify-center" />

    <!-- Empty state -->
    <div
      v-if="events.length === 0"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/40"
    >
      <p class="text-sm">No DOM events recorded</p>
      <p class="text-[11px]">Enable the DOM replay track when recording</p>
    </div>
  </div>
</template>
