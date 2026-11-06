import { shallowRef, watch, type Ref } from "vue";
import { TIMELINE_MAX_AGE_MS } from "@/lib/timeline/markerRing";
import { STRIP_WINDOW_MS } from "@/lib/timeline/stripWindows";
import { useTimelineStore } from "@/stores/timeline.store";
import { TIMELINE_LANES, type TimelineLane } from "@/types/timeline.types";
import {
  buildStripGeometry,
  createStripGeometry,
  type BucketWindow,
  type StripScale,
} from "./stripGeometry";

export interface StripFrameInput {
  now: Ref<number>;
  windowMs: Ref<number>;
  restWidth: Ref<number>;
  laneWidth: Ref<number>;
}

export type LaneTotals = Record<TimelineLane, number>;

const MAX_SECONDS = Math.ceil(STRIP_WINDOW_MS["15m"] / 1000) + 1;

function zeroTotals(): LaneTotals {
  return { errors: 0, network: 0, console: 0, logcat: 0 };
}

function sameTotals(a: LaneTotals, b: LaneTotals): boolean {
  return TIMELINE_LANES.every((lane) => a[lane] === b[lane]);
}

function sum(counts: ArrayLike<number>): number {
  let total = 0;
  for (let index = 0; index < counts.length; index += 1) total += counts[index] ?? 0;
  return total;
}

/**
 * Reads the timeline's per-second buckets on each tick and turns them into strip geometry in
 * reused buffers. `frame` moves on once per rebuild, so canvases repaint at the tick rate and
 * never per marker. `since` is when evidence starts inside the window.
 */
export function useStripFrame(input: StripFrameInput) {
  const timeline = useTimelineStore();
  const geometry = createStripGeometry(MAX_SECONDS);
  const frame = shallowRef(0);
  const totals = shallowRef<LaneTotals>(zeroTotals());
  const restScale = shallowRef<StripScale>({ startMs: 0, windowMs: 1, width: 0 });
  const laneScale = shallowRef<StripScale>({ startMs: 0, windowMs: 1, width: 0 });
  const since = shallowRef(0);

  function rebuild() {
    const now = input.now.value;
    const windowMs = input.windowMs.value;
    const startMs = now - windowMs;
    const fromSecond = Math.floor(startMs / 1000);
    const toSecond = Math.floor(now / 1000) + 1;
    const counts = {} as Record<TimelineLane, Uint32Array>;
    const nextTotals = zeroTotals();
    for (const lane of TIMELINE_LANES) {
      counts[lane] = timeline.ring.bucketRange(fromSecond, toSecond, lane);
      nextTotals[lane] = sum(counts[lane]);
    }
    const buckets: BucketWindow = { fromSecond, counts };
    restScale.value = { startMs, windowMs, width: input.restWidth.value };
    laneScale.value = { startMs, windowMs, width: input.laneWidth.value };
    buildStripGeometry(buckets, restScale.value, laneScale.value, geometry);
    since.value = Math.max(timeline.collectingSince, now - TIMELINE_MAX_AGE_MS);
    if (!sameTotals(totals.value, nextTotals)) totals.value = nextTotals;
    frame.value += 1;
  }

  watch([input.now, input.windowMs, input.restWidth, input.laneWidth], rebuild, {
    immediate: true,
  });

  return { geometry, frame, totals, restScale, laneScale, since };
}
