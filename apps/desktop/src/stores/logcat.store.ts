import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { useDockStore } from "@/stores/dock.store";
import { createFrameBatcher } from "@/lib/frame-batcher";
import { createSerialQueue } from "@/lib/serial-queue";
import { toLogcatEntry } from "@/lib/logcat/logcatEntry";
import {
  runSessionEffect,
  startLogcatLeaseEffect,
  stopLogcatLeaseEffect,
  subscribeSessionEventsEffect,
} from "@/runtime/session";
import type {
  LogcatBatchPayload,
  LogcatClockSample,
  LogcatEntry,
  LogcatStatusPayload,
  LogcatStreamState,
} from "@/types/logcat.types";
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
 * Rust streams one long-running logcat per device and reconnects on its own; this store shows
 * the state it reports, and ignores reports from a run that was replaced.
 */
export const useLogcatStore = defineStore("logcat", () => {
  const dockStore = useDockStore();
  const leaseQueue = createSerialQueue();

  const entries = shallowRef<LogcatEntry[]>([]);
  const serial = ref<string | null>(null);
  const streamState = ref<LogcatStreamState>("stopped");
  const attempt = ref(0);
  const retryInMs = ref<number | null>(null);
  const clock = ref<LogcatClockSample | null>(null);
  const clockWentBack = ref(false);
  const isReady = ref(false);
  const isPaused = ref(false);
  const pausedEntries = shallowRef<LogcatEntry[]>([]);
  const pausedCount = ref(0);
  const error = ref<string | null>(null);
  const unlisten = shallowRef<null | (() => void)>(null);

  const isStreaming = computed(() => streamState.value === "live");

  let initializePromise: Promise<void> | null = null;
  let lastQueuedId: LogcatEntry["id"] | null = null;
  let heldSerial: string | null = null;
  let generation = 0;

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

  function acceptsGeneration(reported: number): boolean {
    if (reported < generation) {
      return false;
    }
    generation = reported;
    return true;
  }

  function handleBatch(batch: LogcatBatchPayload) {
    if (batch.serial !== serial.value || heldSerial !== batch.serial) {
      return;
    }
    if (!acceptsGeneration(batch.generation)) {
      return;
    }
    for (const line of batch.lines) {
      const entry = toLogcatEntry(batch.serial, line);
      if (lastQueuedId === entry.id) {
        continue;
      }
      lastQueuedId = entry.id;
      batcher.push(entry);
    }
  }

  function handleStatus(status: LogcatStatusPayload) {
    if (status.serial !== serial.value || heldSerial !== status.serial) {
      return;
    }
    if (!acceptsGeneration(status.generation)) {
      return;
    }
    streamState.value = status.state;
    attempt.value = status.attempt;
    retryInMs.value = status.retryInMs;
    clockWentBack.value = status.clockWentBack;
    if (status.clock) {
      clock.value = status.clock;
    }
    error.value =
      status.state === "reconnecting" && status.message
        ? `Reconnecting (attempt ${status.attempt}): ${status.message}`
        : null;
  }

  function handleSessionEvent(event: SessionEvent) {
    if (event.type === "logcatBatch") {
      handleBatch(event.batch);
      return;
    }
    if (event.type === "logcatStatus") {
      handleStatus(event.status);
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

  function resetStreamState() {
    streamState.value = "stopped";
    attempt.value = 0;
    retryInMs.value = null;
    clockWentBack.value = false;
  }

  async function releaseHeld() {
    const previous = heldSerial;
    if (!previous) {
      return;
    }
    heldSerial = null;
    resetStreamState();
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
    heldSerial = targetSerial;
    if (streamState.value === "stopped") {
      streamState.value = "connecting";
    }
    try {
      await runSessionEffect(startLogcatLeaseEffect(targetSerial, { restart }), {
        operation: "session.startLogcatLease",
      });
    } catch (err) {
      heldSerial = null;
      resetStreamState();
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
      if (wanted && wanted === heldSerial && wanted === serial.value) {
        return;
      }

      if (heldSerial && heldSerial !== wanted) {
        await releaseHeld();
      }

      if (serial.value !== nextSerial) {
        serial.value = nextSerial;
        clock.value = null;
        clear();
      }

      if (!wanted) {
        if (!nextSerial) {
          error.value = null;
        }
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
    streamState,
    attempt,
    retryInMs,
    clock,
    clockWentBack,
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
