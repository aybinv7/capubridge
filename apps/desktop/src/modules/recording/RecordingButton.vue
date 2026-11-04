<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import { useRecordingStore } from "@/stores/recording.store";
import { useRecordingSession } from "@/composables/useRecordingSession";
import RecordingConfigModal from "./RecordingConfigModal.vue";
import { toast } from "vue-sonner";
import { Button } from "@capubridge/cladd";

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
  <Button
    variant="transparent"
    :outline="false"
    class="h-7.5 border text-sm font-normal"
    :class="{
      'border-signal-rec/40 bg-signal-rec/12 font-mono text-signal-rec':
        recordingStore.phase === 'recording',
      'border-border text-[var(--fg-subtle)]': recordingStore.phase === 'stopping',
      'border-border text-muted-foreground hover:text-foreground': recordingStore.phase === 'idle',
    }"
    content-class-name="gap-2 px-3"
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
      <span
        class="size-1.75 shrink-0 rounded-full border-[1.5px] border-current"
        aria-hidden="true"
      />
      <span>Record</span>
    </template>

    <template v-else-if="recordingStore.phase === 'recording'">
      <span class="size-2 shrink-0 rounded-sm bg-signal-rec" aria-hidden="true" />
      <span>{{ formatElapsed(elapsedMs) }}</span>
    </template>

    <template v-else>
      <span class="size-2 shrink-0 rounded-full bg-[var(--fg-subtle)]" aria-hidden="true" />
      <span>Saving…</span>
    </template>
  </Button>

  <RecordingConfigModal v-model:open="modalOpen" />
</template>
