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
    class="group h-7.5 border text-xs font-normal"
    :class="{
      'border-signal-rec/40 bg-signal-rec/10 text-signal-rec hover:bg-signal-rec/16':
        recordingStore.phase === 'recording',
      'border-border-subtle text-[var(--fg-subtle)]': recordingStore.phase === 'stopping',
      'border-border-subtle text-muted-foreground hover:text-foreground':
        recordingStore.phase === 'idle',
    }"
    content-class-name="gap-2 pl-2.5 pr-3 @max-5xl/titlebar:pr-2.5"
    :disabled="recordingStore.phase === 'stopping'"
    :aria-pressed="recordingStore.phase === 'recording'"
    :title="
      recordingStore.phase === 'recording'
        ? 'Stop and save the session'
        : recordingStore.phase === 'stopping'
          ? 'Saving the session'
          : 'Record what the app does: screen, network, console, storage'
    "
    @click="handleClick"
  >
    <template v-if="recordingStore.phase === 'idle'">
      <span
        class="grid size-3.5 shrink-0 place-items-center rounded-full ring-1 ring-current/40"
        aria-hidden="true"
      >
        <span
          class="size-1.5 rounded-full bg-signal-rec/80 transition-colors group-hover:bg-signal-rec"
        />
      </span>
      <span class="@max-5xl/titlebar:sr-only">Record session</span>
    </template>

    <template v-else-if="recordingStore.phase === 'recording'">
      <span class="relative grid size-3.5 shrink-0 place-items-center" aria-hidden="true">
        <span
          class="absolute size-1.5 rounded-full bg-signal-rec motion-safe:animate-ping group-hover:hidden"
        />
        <span class="size-1.5 rounded-full bg-signal-rec group-hover:hidden" />
        <span class="hidden size-2 rounded-[2px] bg-signal-rec group-hover:block" />
      </span>
      <span class="font-mono tabular-nums">{{ formatElapsed(elapsedMs) }}</span>
    </template>

    <template v-else>
      <span class="size-1.5 shrink-0 rounded-full bg-[var(--fg-subtle)]" aria-hidden="true" />
      <span>Saving…</span>
    </template>
  </Button>

  <RecordingConfigModal v-model:open="modalOpen" />
</template>
