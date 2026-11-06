import { computed, markRaw, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { useDockStore } from "@/stores/dock.store";
import { createFrameBatcher } from "@/lib/frame-batcher";
import { createSerialQueue } from "@/lib/serial-queue";
import { RingBuffer } from "@/lib/ring-buffer";
import { STREAM_CAPS } from "@/lib/stream-caps";
import { createStreamFeed } from "@/lib/stream-feed";
import { toLogcatEntry } from "@/lib/logcat/logcatEntry";
import { createLogcatTally } from "@/lib/logcat/logcatTally";
import { runSessionEffect, startLogcatLeaseEffect, stopLogcatLeaseEffect } from "@/runtime/session";
import type {
  LogcatBatchPayload,
  LogcatClockSample,
  LogcatEntry,
  LogcatStatusPayload,
  LogcatStreamMessage,
  LogcatStreamState,
} from "@/types/logcat.types";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Logcat of the active device, captured at app level. The window holds one lease on the
 * device's capture (Rust shares one run between every window that holds it); views only read.
 * Rust streams one long-running logcat per device, reconnects on its own and sends batches on a
 * channel only this window receives; this store shows the state it reports, and ignores reports
 * from a run or channel that was replaced.
 *
 * Lines live in a ring of {@link STREAM_CAPS.logcat}; each flush appends without copying and
 * updates the level and package tallies incrementally. Consumers subscribe to `feed`.
 */
export const useLogcatStore = defineStore("logcat", () => {
  const dockStore = useDockStore();
  const leaseQueue = createSerialQueue();

  const ring = markRaw(new RingBuffer<LogcatEntry>(STREAM_CAPS.logcat));
  const feed = markRaw(createStreamFeed<LogcatEntry>("logcat"));
  const tally = createLogcatTally();
  const version = shallowRef(0);
  const levelCounts = shallowRef(tally.levels());
  const packages = shallowRef<string[]>([]);

  const serial = ref<string | null>(null);
  const streamState = ref<LogcatStreamState>("stopped");
  const attempt = ref(0);
  const retryInMs = ref<number | null>(null);
  const clock = ref<LogcatClockSample | null>(null);
  const clockWentBack = ref(false);
  const isPaused = ref(false);
  const pausedCount = ref(0);
  const error = ref<string | null>(null);
  const buffers = ref<string[] | null>(null);

  const isStreaming = computed(() => streamState.value === "live");
  const size = computed(() => {
    void version.value;
    return ring.size;
  });
  const pausedDropped = computed(() => Math.max(0, pausedCount.value - ring.capacity));
  const entries = computed<LogcatEntry[]>(() => {
    void version.value;
    return ring.toArray();
  });

  let heldSerial: string | null = null;
  let generation = 0;
  let channelToken = 0;

  function publish() {
    version.value += 1;
    levelCounts.value = tally.levels();
    if (tally.takePackagesChanged()) {
      packages.value = tally.packages();
    }
  }

  /** Appends a batch to the ring and tells subscribers. Exposed for measurement. */
  function flush(batch: readonly LogcatEntry[]) {
    if (batch.length === 0) {
      return;
    }
    const evicted = ring.pushAll(batch);
    tally.add(batch);
    tally.remove(evicted);
    if (isPaused.value) {
      pausedCount.value += batch.length;
    }
    publish();
    feed.emit({ kind: "append", items: batch, evicted });
    dockStore.markUnread("logcat");
  }

  const batcher = createFrameBatcher<LogcatEntry>(flush, STREAM_CAPS.logcat);

  function clear() {
    batcher.clear();
    ring.clear();
    tally.reset();
    pausedCount.value = 0;
    publish();
    packages.value = [];
    feed.emit({ kind: "clear" });
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
          buffers: buffers.value ?? undefined,
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

  /**
   * Picks the logcat buffers to read (`main`, `system`, `crash`, `events`, `kernel`, ...);
   * null goes back to the device default. Restarts the capture so the choice takes effect.
   * The UI does not offer it yet.
   */
  function setBuffers(next: string[] | null) {
    return leaseQueue.run(async () => {
      buffers.value = next && next.length > 0 ? [...next] : ["default"];
      const currentSerial = heldSerial;
      if (!currentSerial) {
        return;
      }
      clear();
      await acquire(currentSerial, true);
    });
  }

  /** Freezes the views; capture goes on and every new line is kept in the ring. */
  function pause() {
    batcher.flushNow();
    pausedCount.value = 0;
    isPaused.value = true;
  }

  function resume() {
    batcher.flushNow();
    isPaused.value = false;
    pausedCount.value = 0;
  }

  function togglePaused() {
    if (isPaused.value) {
      resume();
      return;
    }
    pause();
  }

  return {
    ring,
    feed,
    version,
    size,
    entries,
    levelCounts,
    packages,
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
    flush,
    follow,
    restart,
    buffers,
    setBuffers,
    pause,
    resume,
    togglePaused,
    clear,
  };
});
