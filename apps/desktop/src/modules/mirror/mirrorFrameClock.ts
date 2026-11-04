export interface FrameReading {
  /** Frames drawn inside the last window, scaled to one second. */
  fps: number;
  /** When the last frame was drawn (performance clock), or null before the first one. */
  lastFrameAt: number | null;
  /** Milliseconds since the last frame, or null before the first one. */
  ageMs: number | null;
}

export interface FrameClock {
  record: (at: number) => void;
  reset: () => void;
  read: (now: number) => FrameReading;
}

export const EMPTY_FRAME_READING: FrameReading = { fps: 0, lastFrameAt: null, ageMs: null };

/**
 * Counts drawn frames in a fixed ring of timestamps, so the decoder's hot path stays a single
 * array write with no allocation and no reactivity. Readers poll `read` at their own pace.
 */
export function createFrameClock(windowMs = 1000, capacity = 256): FrameClock {
  const stamps = new Float64Array(capacity);
  let head = 0;
  let count = 0;
  let last: number | null = null;

  function record(at: number) {
    stamps[head] = at;
    head = (head + 1) % capacity;
    if (count < capacity) count += 1;
    last = at;
  }

  function reset() {
    head = 0;
    count = 0;
    last = null;
  }

  function read(now: number): FrameReading {
    if (last === null) return EMPTY_FRAME_READING;
    const since = now - windowMs;
    let inWindow = 0;
    for (let offset = 1; offset <= count; offset += 1) {
      const stamp = stamps[(head - offset + capacity) % capacity];
      if (stamp <= since) break;
      if (stamp <= now) inWindow += 1;
    }
    return {
      fps: Math.round((inWindow * 1000) / windowMs),
      lastFrameAt: last,
      ageMs: Math.max(0, now - last),
    };
  }

  return { record, reset, read };
}
