import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useDevicesStore } from "@/stores/devices.store";
import { useDockStore } from "@/stores/dock.store";
import type { LogcatEntry, LogcatErrorPayload } from "@/types/console.types";

const maxLogcatEntries = 900;
const maxPausedBufferEntries = 400;

function trimEntries(entries: LogcatEntry[]): LogcatEntry[] {
  return entries.length > maxLogcatEntries
    ? entries.slice(entries.length - maxLogcatEntries)
    : entries;
}

function trimPausedEntries(entries: LogcatEntry[]): LogcatEntry[] {
  return entries.length > maxPausedBufferEntries
    ? entries.slice(entries.length - maxPausedBufferEntries)
    : entries;
}

export const useLogcatStore = defineStore("logcat", () => {
  const devicesStore = useDevicesStore();
  const dockStore = useDockStore();

  const entries = ref<LogcatEntry[]>([]);
  const serial = ref<string | null>(null);
  const isStreaming = ref(false);
  const isReady = ref(false);
  const isPaused = ref(false);
  const pausedEntries = ref<LogcatEntry[]>([]);
  const pausedCount = ref(0);
  const error = ref<string | null>(null);

  let initializePromise: Promise<void> | null = null;
  function clear() {
    entries.value = [];
    pausedEntries.value = [];
    pausedCount.value = 0;
  }

  function pushEntry(entry: LogcatEntry) {
    if (entry.serial !== serial.value) {
      return;
    }

    const lastEntry = entries.value.at(-1);
    if (lastEntry?.id === entry.id) {
      return;
    }

    if (isPaused.value) {
      pausedEntries.value = trimPausedEntries([...pausedEntries.value, entry]);
      pausedCount.value += 1;
      dockStore.markUnread("logcat");
      return;
    }

    entries.value = trimEntries([...entries.value, entry]);
    dockStore.markUnread("logcat");
  }

  async function stopStream(targetSerial: string | null) {
    if (!targetSerial) {
      return;
    }

    try {
      await invoke("stop_logcat", { serial: targetSerial });
    } catch {}

    if (serial.value === targetSerial) {
      isStreaming.value = false;
    }
  }

  async function startStream(targetSerial: string) {
    if (serial.value === targetSerial && isStreaming.value) {
      return;
    }

    error.value = null;
    serial.value = targetSerial;
    entries.value = [];
    pausedEntries.value = [];
    pausedCount.value = 0;

    try {
      await invoke("start_logcat", { serial: targetSerial });
      isStreaming.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      isStreaming.value = false;
    }
  }

  async function syncSerial(nextSerial: string | null, previousSerial: string | null) {
    if (previousSerial && previousSerial !== nextSerial) {
      await stopStream(previousSerial);
    }

    if (!nextSerial) {
      serial.value = null;
      entries.value = [];
      pausedEntries.value = [];
      pausedCount.value = 0;
      error.value = null;
      isStreaming.value = false;
      return;
    }

    await startStream(nextSerial);
  }

  async function initialize() {
    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
      if (isReady.value) {
        return;
      }

      await listen<LogcatEntry>("logcat:line", (event) => {
        pushEntry(event.payload);
      });

      await listen<LogcatErrorPayload>("logcat:error", (event) => {
        if (event.payload.serial !== serial.value) {
          return;
        }

        error.value = event.payload.message;
        isStreaming.value = false;
      });

      await listen<string>("logcat:stopped", (event) => {
        if (event.payload !== serial.value) {
          return;
        }

        isStreaming.value = false;
      });

      watch(
        () => devicesStore.selectedDevice?.serial ?? null,
        (nextSerial, previousSerial) => {
          void syncSerial(nextSerial, previousSerial ?? null);
        },
        { immediate: true },
      );

      isReady.value = true;
    })();

    return initializePromise;
  }

  async function restart() {
    await syncSerial(devicesStore.selectedDevice?.serial ?? null, serial.value);
  }

  function resume() {
    if (!isPaused.value) {
      return;
    }

    isPaused.value = false;
    if (pausedEntries.value.length > 0) {
      entries.value = trimEntries([...entries.value, ...pausedEntries.value]);
      pausedEntries.value = [];
      pausedCount.value = 0;
    }
  }

  function pause() {
    isPaused.value = true;
  }

  function togglePaused() {
    if (isPaused.value) {
      resume();
      return;
    }

    pause();
  }

  return {
    entries,
    serial,
    isStreaming,
    isReady,
    isPaused,
    pausedCount,
    error,
    initialize,
    restart,
    pause,
    resume,
    togglePaused,
    clear,
  };
});
