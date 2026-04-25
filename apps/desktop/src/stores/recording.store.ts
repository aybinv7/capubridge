import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { RecordingConfig } from "@/types/replay.types";

export type RecordingPhase = "idle" | "configuring" | "recording" | "stopping";

export const useRecordingStore = defineStore("recording", () => {
  // State
  const phase = ref<RecordingPhase>("idle");
  const sessionId = ref<string | null>(null);
  const startedAt = ref<number | null>(null);
  const config = ref<RecordingConfig | null>(null);
  const errorMessage = ref<string | null>(null);

  // Getters
  const isRecording = computed(() => phase.value === "recording");
  const isConfiguring = computed(() => phase.value === "configuring");
  const isStopping = computed(() => phase.value === "stopping");

  // NOTE: do NOT add an elapsedMs computed here — Date.now() is not reactive and
  // computed() won't re-evaluate it. Components that need a live timer should
  // implement their own setInterval that reads startedAt directly.

  // Actions
  function setPhase(newPhase: RecordingPhase, newSessionId?: string) {
    phase.value = newPhase;
    if (newSessionId !== undefined) sessionId.value = newSessionId;
    if (newPhase === "recording" && startedAt.value === null) {
      startedAt.value = Date.now();
    }
    errorMessage.value = null;
  }

  function setConfig(newConfig: RecordingConfig) {
    config.value = newConfig;
  }

  function setError(msg: string) {
    errorMessage.value = msg;
    phase.value = "idle";
  }

  function reset() {
    phase.value = "idle";
    sessionId.value = null;
    startedAt.value = null;
    config.value = null;
    errorMessage.value = null;
  }

  return {
    phase,
    sessionId,
    startedAt,
    config,
    errorMessage,
    isRecording,
    isConfiguring,
    isStopping,
    setPhase,
    setConfig,
    setError,
    reset,
  };
});
