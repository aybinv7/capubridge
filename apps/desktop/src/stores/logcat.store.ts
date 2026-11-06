import { ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { useDockStore } from "@/stores/dock.store";
import { createFrameBatcher } from "@/lib/frame-batcher";
import { createSerialQueue } from "@/lib/serial-queue";
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Logcat of the active device, captured at app level. The window holds one lease on the
 * device's capture (Rust shares one run between every window that holds it); views only read.
 */
export const useLogcatStore = defineStore("logcat", () => {
  const dockStore = useDockStore();
  const leaseQueue = createSerialQueue();

  const entries = shallowRef<LogcatEntry[]>([]);
  const serial = ref<string | null>(null);
  const isStreaming = ref(false);
  const isReady = ref(false);
  const isPaused = ref(false);
  const pausedEntries = shallowRef<LogcatEntry[]>([]);
  const pausedCount = ref(0);
  const error = ref<string | null>(null);
  const unlisten = shallowRef<null | (() => void)>(null);

  let initializePromise: Promise<void> | null = null;
  let lastQueuedId: LogcatEntry["id"] | null = null;
  let heldSerial: string | null = null;

  const batcher = createFrameBatcher<LogcatEntry>((batch) => {
    if (isPaused.value) {
      pausedEntries.value = trimPausedEntries(pausedEntries.value.concat(batch));
      pausedCount.value += batch.length;
    } else {
      entries.value = trimEntries(entries.value.concat(batch));
    }
    dockStore.markUnread("logcat");
  }, maxLogcatEntries);

  function clear() {
    batcher.clear();
    lastQueuedId = null;
    entries.value = [];
    pausedEntries.value = [];
    pausedCount.value = 0;
  }

  function pushEntry(entry: LogcatEntry) {
    if (entry.serial !== serial.value) {
      return;
    }

    if (lastQueuedId === entry.id) {
      return;
    }
    lastQueuedId = entry.id;
    batcher.push(entry);
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

      isStreaming.value = event.lease.active && heldSerial === event.lease.serial;
    }
  }

  async function initialize() {
    if (isReady.value) {
      return;
    }
    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
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

  async function releaseHeld() {
    const previous = heldSerial;
    if (!previous) {
      return;
    }
    heldSerial = null;
    isStreaming.value = false;
    try {
      await runSessionEffect(stopLogcatLeaseEffect(previous), {
        operation: "session.stopLogcatLease",
      });
    } catch (err) {
      error.value = `Could not release the logcat stream: ${errorMessage(err)}`;
    }
  }

  async function acquire(targetSerial: string, restart: boolean) {
    error.value = null;
    try {
      await runSessionEffect(startLogcatLeaseEffect(targetSerial, { restart }), {
        operation: "session.startLogcatLease",
      });
      heldSerial = targetSerial;
      isStreaming.value = serial.value === targetSerial;
    } catch (err) {
      heldSerial = null;
      isStreaming.value = false;
      error.value = errorMessage(err);
    }
  }

  /**
   * Follows `nextSerial`: holds its capture and lets go of the previous device's. While the
   * device is offline the lease is released but its lines are kept. Calls are queued, so fast
   * switching cannot interleave a stop with a start.
   */
  function follow(nextSerial: string | null, online = true) {
    return leaseQueue.run(async () => {
      await initialize();
      const wanted = online ? nextSerial : null;
      if (wanted && wanted === heldSerial && wanted === serial.value && isStreaming.value) {
        return;
      }

      if (heldSerial && heldSerial !== wanted) {
        await releaseHeld();
      }

      if (serial.value !== nextSerial) {
        serial.value = nextSerial;
        clear();
      }

      if (!wanted) {
        if (!nextSerial) {
          error.value = null;
        }
        isStreaming.value = false;
        return;
      }

      await acquire(wanted, false);
    });
  }

  /** Starts a fresh capture run for the current device and clears the view. */
  function restart() {
    return leaseQueue.run(async () => {
      await initialize();
      const currentSerial = serial.value;
      if (!currentSerial) {
        return;
      }
      clear();
      await acquire(currentSerial, true);
    });
  }

  function resume() {
    if (!isPaused.value) {
      return;
    }

    batcher.flushNow();
    isPaused.value = false;
    if (pausedEntries.value.length > 0) {
      entries.value = trimEntries(entries.value.concat(pausedEntries.value));
      pausedEntries.value = [];
      pausedCount.value = 0;
    }
  }

  function pause() {
    batcher.flushNow();
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
    await follow(null);
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
    follow,
    restart,
    pause,
    resume,
    togglePaused,
    clear,
    dispose,
  };
});
