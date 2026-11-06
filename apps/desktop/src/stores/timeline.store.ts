import { markRaw, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { MarkerRing, TIMELINE_MAX_AGE_MS } from "@/lib/timeline/markerRing";
import { deviceToHostMs } from "@/lib/timeline/hostClock";
import type {
  DeviceClockOffset,
  TimelineMarkerInput,
  TimelineMarkerRef,
  TimelineOverlay,
  TimelineOverlayKind,
} from "@/types/timeline.types";

const MAX_OVERLAYS = 200;

/**
 * Markers for the global timeline: where evidence happened, on one host clock. Evidence itself
 * stays in its source store; a marker only points at it. Sources push through the feed wiring
 * (`useTimelineFeeds`); modules never import each other. Holds 20,000 markers or 10 minutes.
 */
export const useTimelineStore = defineStore("timeline", () => {
  const ring = markRaw(new MarkerRing());
  const version = shallowRef(0);
  const overlays = shallowRef<TimelineOverlay[]>([]);
  const clockOffsets = ref<Record<string, DeviceClockOffset>>({});
  /** Host time from which markers are complete: store creation, or the last {@link clear}. */
  const collectingSince = shallowRef(Date.now());
  let overlayCounter = 0;

  /** Adds markers and bumps the version once; returns how many were kept. */
  function pushMany(markers: readonly TimelineMarkerInput[]): number {
    let kept = 0;
    for (const marker of markers) {
      if (ring.push(marker)) kept += 1;
    }
    if (kept > 0) {
      version.value += 1;
    }
    return kept;
  }

  function push(marker: TimelineMarkerInput): boolean {
    return pushMany([marker]) === 1;
  }

  /** Records the measured clock of a device, for conversion and for display. */
  function setClockOffset(serial: string, offset: DeviceClockOffset | null) {
    if (!offset) {
      if (serial in clockOffsets.value) {
        const next = { ...clockOffsets.value };
        delete next[serial];
        clockOffsets.value = next;
      }
      return;
    }
    clockOffsets.value = { ...clockOffsets.value, [serial]: offset };
  }

  /** Converts a device wall-clock time to host time; non-device sources pass `null`. */
  function toHostMs(serial: string | null | undefined, deviceMs: number): number {
    return deviceToHostMs(deviceMs, serial ? clockOffsets.value[serial] : null);
  }

  function pruneOverlays(list: TimelineOverlay[], now: number): TimelineOverlay[] {
    const cutoff = now - TIMELINE_MAX_AGE_MS;
    const kept = list.filter((overlay) => overlay.end === null || overlay.end >= cutoff);
    return kept.length > MAX_OVERLAYS ? kept.slice(kept.length - MAX_OVERLAYS) : kept;
  }

  /** A hairline overlay (navigation, target switch) at `t`. */
  function addHairline(
    kind: TimelineOverlayKind,
    t: number,
    label: string,
    markerRef: TimelineMarkerRef | null = null,
  ): string {
    overlayCounter += 1;
    const id = `${kind}:${overlayCounter}`;
    overlays.value = pruneOverlays(
      [...overlays.value, { id, kind, start: t, end: t, label, ref: markerRef }],
      t,
    );
    return id;
  }

  /** Opens a range overlay (a recording); close it with {@link endRange}. */
  function beginRange(
    kind: TimelineOverlayKind,
    t: number,
    label: string,
    markerRef: TimelineMarkerRef | null = null,
  ): string {
    overlayCounter += 1;
    const id = `${kind}:${overlayCounter}`;
    overlays.value = pruneOverlays(
      [...overlays.value, { id, kind, start: t, end: null, label, ref: markerRef }],
      t,
    );
    return id;
  }

  function endRange(id: string, t: number) {
    overlays.value = overlays.value.map((overlay) =>
      overlay.id === id && overlay.end === null ? { ...overlay, end: t } : overlay,
    );
  }

  /** Drops markers and overlays older than 10 minutes before `now`. */
  function ageOut(now: number = Date.now()) {
    if (ring.ageOut(now) > 0) {
      version.value += 1;
    }
    const kept = pruneOverlays(overlays.value, now);
    if (kept.length !== overlays.value.length) {
      overlays.value = kept;
    }
  }

  function clear() {
    ring.clear();
    overlays.value = [];
    collectingSince.value = Date.now();
    version.value += 1;
  }

  return {
    ring,
    version,
    overlays,
    clockOffsets,
    collectingSince,
    push,
    pushMany,
    setClockOffset,
    toHostMs,
    addHairline,
    beginRange,
    endRange,
    ageOut,
    clear,
  };
});
