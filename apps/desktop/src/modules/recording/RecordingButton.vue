<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import { Circle, Square } from "lucide-vue-next";
import { useRecordingStore } from "@/stores/recording.store";
import { useRecordingSession } from "@/composables/useRecordingSession";
import RecordingConfigModal from "./RecordingConfigModal.vue";
import { toast } from "vue-sonner";

const recordingStore = useRecordingStore();
const { stop } = useRecordingSession();

const modalOpen = ref(false);
const elapsedMs = ref(0);
let elapsedInterval: ReturnType<typeof setInterval> | null = null;

watch(
  () => recordingStore.phase,
  (phase) => {
    if (phase === "recording") {
      elapsedMs.value = 0;
      elapsedInterval = setInterval(() => {
        elapsedMs.value = recordingStore.startedAt ? Date.now() - recordingStore.startedAt : 0;
      }, 1000);
    } else {
      if (elapsedInterval !== null) {
        clearInterval(elapsedInterval);
        elapsedInterval = null;
      }
    }
  },
);

onUnmounted(() => {
  if (elapsedInterval !== null) clearInterval(elapsedInterval);
});

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

async function handleClick() {
  if (recordingStore.phase === "idle") {
    modalOpen.value = true;
  } else if (recordingStore.phase === "recording") {
    const capuPath = await stop();
    if (capuPath) {
      toast.success("Session saved", { description: capuPath });
    }
  }
}
</script>

<template>
  <button
    class="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] transition-all border ml-1"
    :class="{
      'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20':
        recordingStore.phase === 'recording',
      'border-border/15 text-muted-foreground/20 cursor-not-allowed pointer-events-none':
        recordingStore.phase === 'stopping',
      'border-border/25 text-muted-foreground/50 hover:text-foreground hover:border-border-active hover:bg-surface-2':
        recordingStore.phase === 'idle',
    }"
    :disabled="recordingStore.phase === 'stopping'"
    :title="
      recordingStore.phase === 'recording'
        ? 'Stop recording'
        : recordingStore.phase === 'stopping'
          ? 'Finalizing...'
          : 'Start recording session'
    "
    @click="handleClick"
  >
    <template v-if="recordingStore.phase === 'idle'">
      <Circle class="w-3 h-3" />
      <span>Record</span>
    </template>

    <template v-else-if="recordingStore.phase === 'recording'">
      <span class="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
      <span>{{ formatElapsed(elapsedMs) }}</span>
      <Square class="w-2.5 h-2.5 fill-current" />
    </template>

    <template v-else>
      <span class="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-pulse" />
      <span>Saving…</span>
    </template>
  </button>

  <RecordingConfigModal v-model:open="modalOpen" />
</template>
