import type { TimelineLane, TimelineMarker, TimelineMarkerRef } from "@/types/timeline.types";

export const MOMENT_ITEM_LIMIT = 20;

/** Whether the evidence behind an item can still be shown. */
export type MomentItemState = "kept" | "aged-out" | "unreachable";

export interface MomentItem {
  key: string;
  t: number;
  lane: TimelineLane;
  label: string;
  ref: TimelineMarkerRef;
  state: MomentItemState;
  /** Plain words for an item that cannot be shown; null while it is kept. */
  note: string | null;
}

export interface MomentSummary {
  items: MomentItem[];
  /** Distinct items in the second, before the limit. */
  total: number;
  /** Markers per lane in the second; muted lanes count zero. */
  counts: Record<TimelineLane, number>;
}

/** What the reveal registry knows about a marker's section. */
export interface MomentSources {
  isMuted(lane: TimelineLane): boolean;
  hasReveal(kind: TimelineMarkerRef["kind"]): boolean;
  isKept(ref: TimelineMarkerRef): boolean;
  retentionOf(kind: TimelineMarkerRef["kind"]): string | null;
}

function refKey(ref: TimelineMarkerRef): string {
  return `${ref.kind}:${ref.id}`;
}

function stateOf(ref: TimelineMarkerRef, sources: MomentSources): MomentItemState {
  if (!sources.hasReveal(ref.kind)) return "unreachable";
  return sources.isKept(ref) ? "kept" : "aged-out";
}

function noteOf(state: MomentItemState, ref: TimelineMarkerRef, sources: MomentSources) {
  if (state === "kept") return null;
  if (state === "unreachable") return "This section cannot show it from here yet";
  const keeps = sources.retentionOf(ref.kind);
  return keeps ? `No longer kept — ${keeps}` : "No longer kept";
}

/**
 * The items of one second for the moment preview: muted lanes left out, one item per piece of
 * evidence (a `console.error` is on both Console and Errors; it is listed once, as an error
 * while Errors is on), in time order, at most `limit`. Aged-out items stay listed and say so.
 */
export function buildMoment(
  markers: readonly TimelineMarker[],
  sources: MomentSources,
  limit = MOMENT_ITEM_LIMIT,
): MomentSummary {
  const counts: Record<TimelineLane, number> = { errors: 0, network: 0, console: 0, logcat: 0 };
  const byRef = new Map<string, TimelineMarker>();
  for (const marker of markers) {
    if (sources.isMuted(marker.lane)) continue;
    counts[marker.lane] += 1;
    const key = refKey(marker.ref);
    const seen = byRef.get(key);
    if (!seen || (marker.lane === "errors" && seen.lane !== "errors")) byRef.set(key, marker);
  }
  const ordered = [...byRef.values()].sort((a, b) => a.t - b.t || a.seq - b.seq);
  const items = ordered.slice(0, limit).map<MomentItem>((marker) => {
    const state = stateOf(marker.ref, sources);
    return {
      key: refKey(marker.ref),
      t: marker.t,
      lane: marker.lane,
      label: marker.label,
      ref: marker.ref,
      state,
      note: noteOf(state, marker.ref, sources),
    };
  });
  return { items, total: ordered.length, counts };
}
