import { ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { useDockStore } from "@/stores/dock.store";
import {
  runSessionEffect,
  startLogcatLeaseEffect,
  stopLogcatLeaseEffect,
  subscribeSessionEventsEffect,
} from "@/runtime/session";
import type { LogcatEntry } from "@/types/console.types";
import type { SessionEvent } from "@/types/session.types";

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
  const dockStore = useDockStore();

  const entries = ref<LogcatEntry[]>([]);
  const serial = ref<string | null>(null);
  const isStreaming = ref(false);
  const isReady = ref(false);
  const isPaused = ref(false);
  const pausedEntries = ref<LogcatEntry[]>([]);
  const pausedCount = ref(0);
  const error = ref<string | null>(null);
  const unlisten = shallowRef<null | (() => void)>(null);

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

  function handleSessionEvent(event: SessionEvent) {
    if (event.type === "logcatEntry") {
      pushEntry(event.entry);
      return;
    }

    if (event.type === "logcatError") {
      if (event.serial !== serial.value) {
        return;
      }

      error.value = event.message;
      isStreaming.value = false;
      return;
    }

    if (event.type === "leaseStateChanged") {
      if (event.lease.kind !== "logcat" || event.lease.serial !== serial.value) {
        return;
      }

      isStreaming.value = event.lease.active;
    }
  }

  async function initialize() {
    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
      if (isReady.value) {
        return;
      }

      if (!unlisten.value) {
        unlisten.value = await runSessionEffect(subscribeSessionEventsEffect(handleSessionEvent), {
          operation: "session.subscribeLogcat",
        });
      }

      isReady.value = true;
    })().finally(() => {
      initializePromise = null;
    });

    return initializePromise;
  }

  async function stopLease(targetSerial: string | null) {
    if (!targetSerial) {
      return;
    }

    try {
      await runSessionEffect(stopLogcatLeaseEffect(targetSerial), {
        operation: "session.stopLogcatLease",
      });
    } catch (error) {
      console.warn("Failed to release logcat session lease", error);
    }

    if (serial.value === targetSerial) {
      isStreaming.value = false;
    }
  }

  async function startLease(targetSerial: string) {
    error.value = null;
    serial.value = targetSerial;
    clear();

    try {
      await runSessionEffect(startLogcatLeaseEffect(targetSerial), {
        operation: "session.startLogcatLease",
      });
      isStreaming.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      isStreaming.value = false;
      throw err;
    }
  }

  async function syncLease(
    nextSerial: string | null,
    previousSerial: string | null = serial.value,
  ) {
    await initialize();

    if (previousSerial && previousSerial !== nextSerial) {
      await stopLease(previousSerial);
    }

    if (!nextSerial) {
      serial.value = null;
      clear();
      error.value = null;
      isStreaming.value = false;
      return;
    }

    if (serial.value === nextSerial && isStreaming.value) {
      return;
    }

    await startLease(nextSerial);
  }

  async function restart() {
    await initialize();
    if (!serial.value) {
      return;
    }

    const currentSerial = serial.value;
    await stopLease(currentSerial);
    await startLease(currentSerial);
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

  async function dispose() {
    await stopLease(serial.value);
    const stopListening = unlisten.value;
    unlisten.value = null;
    if (stopListening) {
      stopListening();
    }
    isReady.value = false;
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
    syncLease,
    restart,
    pause,
    resume,
    togglePaused,
    clear,
    dispose,
  };
});
