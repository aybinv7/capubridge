<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
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
    type="button"
    class="flex h-7 items-center gap-1.5 rounded-md px-2 font-mono text-xs transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
    :class="{
      'bg-signal-rec/12 text-signal-rec hover:bg-signal-rec/20':
        recordingStore.phase === 'recording',
      'pointer-events-none text-[var(--fg-subtle)]': recordingStore.phase === 'stopping',
      'text-muted-foreground hover:bg-[var(--bg-surface-raised)] hover:text-foreground':
        recordingStore.phase === 'idle',
    }"
    :disabled="recordingStore.phase === 'stopping'"
    :aria-pressed="recordingStore.phase === 'recording'"
    :title="
      recordingStore.phase === 'recording'
        ? 'Stop recording'
        : recordingStore.phase === 'stopping'
          ? 'Finalizing…'
          : 'Record a session'
    "
    @click="handleClick"
  >
    <template v-if="recordingStore.phase === 'idle'">
      <span class="h-2 w-2 rounded-full bg-signal-rec" />
      <span class="font-sans">Record</span>
    </template>

    <template v-else-if="recordingStore.phase === 'recording'">
      <span class="h-2 w-2 rounded-sm bg-signal-rec" />
      <span>{{ formatElapsed(elapsedMs) }}</span>
    </template>

    <template v-else>
      <span class="h-2 w-2 rounded-full bg-[var(--fg-subtle)]" />
      <span class="font-sans">Saving…</span>
    </template>
  </button>

  <RecordingConfigModal v-model:open="modalOpen" />
</template>
