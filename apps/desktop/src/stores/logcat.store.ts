import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { useDockStore } from "@/stores/dock.store";
import { createFrameBatcher } from "@/lib/frame-batcher";
import { createSerialQueue } from "@/lib/serial-queue";
import { toLogcatEntry } from "@/lib/logcat/logcatEntry";
import { runSessionEffect, startLogcatLeaseEffect, stopLogcatLeaseEffect } from "@/runtime/session";
import type {
  LogcatBatchPayload,
  LogcatClockSample,
  LogcatEntry,
  LogcatStatusPayload,
  LogcatStreamMessage,
  LogcatStreamState,
} from "@/types/logcat.types";

const maxLogcatEntries = 900;
const maxPausedBufferEntries = maxLogcatEntries;

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
 * Rust streams one long-running logcat per device, reconnects on its own and sends batches on a
 * channel only this window receives; this store shows the state it reports, and ignores reports
 * from a run or channel that was replaced.
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
  const isPaused = ref(false);
  const pausedEntries = shallowRef<LogcatEntry[]>([]);
  const pausedCount = ref(0);
  const pausedDropped = ref(0);
  const error = ref<string | null>(null);

  const isStreaming = computed(() => streamState.value === "live");

  let heldSerial: string | null = null;
  let generation = 0;
  let channelToken = 0;

  const batcher = createFrameBatcher<LogcatEntry>((batch) => {
    if (isPaused.value) {
      const combined = pausedEntries.value.concat(batch);
      const kept = trimPausedEntries(combined);
      pausedDropped.value += combined.length - kept.length;
      pausedEntries.value = kept;
      pausedCount.value = kept.length;
    } else {
      entries.value = trimEntries(entries.value.concat(batch));
    }
    dockStore.markUnread("logcat");
  }, maxLogcatEntries);

  function clear() {
    batcher.clear();
    entries.value = [];
    pausedEntries.value = [];
    pausedCount.value = 0;
    pausedDropped.value = 0;
  }

  function acceptsGeneration(reported: number): boolean {
    if (reported < generation) {
      return false;
    }
    generation = reported;
    return true;
  }

  function handleBatch(batch: LogcatBatchPayload) {
    if (batch.serial !== serial.value || !acceptsGeneration(batch.generation)) {
      return;
    }
    for (const line of batch.lines) {
      batcher.push(toLogcatEntry(batch.serial, line));
    }
  }

  function handleStatus(status: LogcatStatusPayload) {
    if (status.serial !== serial.value || !acceptsGeneration(status.generation)) {
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

  function handleMessage(token: number, message: LogcatStreamMessage) {
    if (token !== channelToken) {
      return;
    }
    if (message.type === "batch") {
      handleBatch(message.payload);
      return;
    }
    handleStatus(message.payload);
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
    channelToken += 1;
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
    const token = ++channelToken;
    if (streamState.value === "stopped") {
      streamState.value = "connecting";
    }
    try {
      await runSessionEffect(
        startLogcatLeaseEffect(targetSerial, (message) => handleMessage(token, message), {
          restart,
        }),
        { operation: "session.startLogcatLease" },
      );
    } catch (err) {
      if (token === channelToken) {
        heldSerial = null;
        resetStreamState();
        error.value = errorMessage(err);
      }
    }
  }

  /**
   * Follows `nextSerial`: holds its capture and lets go of the previous device's. While the
   * device is offline the lease is released but its lines are kept. Calls are queued, so fast
   * switching cannot interleave a stop with a start.
   */
  function follow(nextSerial: string | null, online = true) {
    return leaseQueue.run(async () => {
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
    pausedDropped.value = 0;
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

  return {
    entries,
    serial,
    streamState,
    attempt,
    retryInMs,
    clock,
    clockWentBack,
    isStreaming,
    isPaused,
    pausedCount,
    pausedDropped,
    error,
    follow,
    restart,
    pause,
    resume,
    togglePaused,
    clear,
  };
});
