import type { TrackName } from "@/types/replay.types";
import { invokeCommand } from "@/runtime/ipc/client";

interface BufferedEvent {
  t: number;
  data: unknown;
}

export function useSessionWriter(sessionId: string, startedAt: number, flushIntervalMs = 2000) {
  const buffers: Record<TrackName, BufferedEvent[]> = {
    rrweb: [],
    network: [],
    console: [],
    perf: [],
    databases: [],
  };

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let flushQueue: Promise<void> = Promise.resolve();

  function push(track: TrackName, data: unknown) {
    pushAt(track, data, Date.now());
  }

  function pushAt(track: TrackName, data: unknown, wallMs: number) {
    buffers[track].push({ t: wallMs - startedAt, data });
  }

  function bufferSize(): number {
    return Object.values(buffers).reduce((sum, arr) => sum + arr.length, 0);
  }

  function drainAsNdjson(track: TrackName): string {
    const events = buffers[track].splice(0);
    return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  }

  async function flushBuffers() {
    const tracks = Object.entries(buffers) as [TrackName, BufferedEvent[]][];
    const failures: string[] = [];
    for (const [track, events] of tracks) {
      if (events.length === 0) continue;
      const batch = events.splice(0);
      const ndjson = batch.map((e) => JSON.stringify(e)).join("\n") + "\n";
      try {
        await invokeCommand("recording_session_append", {
          sessionId,
          track,
          ndjsonBatch: ndjson,
        });
      } catch (err) {
        events.unshift(...batch);
        failures.push(`${track}: ${String(err)}`);
      }
    }
    if (failures.length > 0) {
      throw new Error(`Recording flush failed (${failures.join("; ")})`);
    }
  }

  function flush() {
    const pending = flushQueue.then(flushBuffers);
    flushQueue = pending.catch((error) => {
      console.error("[SessionWriter] flush failed", error);
    });
    return pending;
  }

  function start() {
    if (intervalId !== null) return;
    intervalId = setInterval(() => {
      void flush().catch((error) => {
        console.error("[SessionWriter] scheduled flush failed", error);
      });
    }, flushIntervalMs);
  }

  async function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    await flush();
    if (bufferSize() > 0) {
      throw new Error(`Recording stopped with ${bufferSize()} buffered events`);
    }
  }

  return { push, pushAt, flush, start, stop, bufferSize, drainAsNdjson };
}
