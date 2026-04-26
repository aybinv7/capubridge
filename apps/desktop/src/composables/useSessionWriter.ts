import { invoke } from "@tauri-apps/api/core";
import type { TrackName } from "@/types/replay.types";

interface BufferedEvent {
  t: number;
  data: unknown;
}

export function useSessionWriter(sessionId: string, startedAt: number, flushIntervalMs = 2000) {
  const buffers: Record<TrackName, BufferedEvent[]> = {
    rrweb: [],
    network: [],
    console: [],
  };

  let intervalId: ReturnType<typeof setInterval> | null = null;

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

  async function flush() {
    const tracks = Object.entries(buffers) as [TrackName, BufferedEvent[]][];
    for (const [track, events] of tracks) {
      if (events.length === 0) continue;
      const batch = events.splice(0);
      const ndjson = batch.map((e) => JSON.stringify(e)).join("\n") + "\n";
      try {
        await invoke<void>("recording_session_append", {
          sessionId,
          track,
          ndjsonBatch: ndjson,
        });
      } catch (err) {
        events.unshift(...batch);
        console.error(`[SessionWriter] flush failed for track ${track}:`, err);
      }
    }
  }

  function start() {
    if (intervalId !== null) return;
    intervalId = setInterval(flush, flushIntervalMs);
  }

  async function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    await flush();
  }

  return { push, pushAt, flush, start, stop, bufferSize, drainAsNdjson };
}
