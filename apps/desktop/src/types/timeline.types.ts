/** Evidence lanes of the global timeline, in drawing order. */
export const TIMELINE_LANES = ["errors", "network", "console", "logcat"] as const;
export type TimelineLane = (typeof TIMELINE_LANES)[number];

/** Marker severity, lowest first. */
export const TIMELINE_SEVERITIES = ["verbose", "info", "warning", "error"] as const;
export type TimelineSeverity = (typeof TIMELINE_SEVERITIES)[number];

/** Which section owns the evidence behind a marker, and its id there. */
export interface TimelineMarkerRef {
  kind: "logcat" | "console" | "exception" | "network" | "recording" | "navigation" | "target";
  id: string;
}

/** A marker as sources push it. `t` is host epoch ms; `label` is cut to 80 characters. */
export interface TimelineMarkerInput {
  t: number;
  lane: TimelineLane;
  severity: TimelineSeverity;
  ref: TimelineMarkerRef;
  label: string;
}

/** A kept marker with its arrival order. */
export interface TimelineMarker extends TimelineMarkerInput {
  seq: number;
}

/** Overlays have no lane: ranges (recordings) and hairlines (navigation, target switches). */
export type TimelineOverlayKind = "recording" | "navigation" | "target";

export interface TimelineOverlay {
  id: string;
  kind: TimelineOverlayKind;
  start: number;
  /** null while a range is still open; equal to `start` for a hairline. */
  end: number | null;
  label: string;
  ref: TimelineMarkerRef | null;
}

/** Device clock relative to the host: `hostMs = deviceMs - offsetMs`. */
export interface DeviceClockOffset {
  offsetMs: number;
  rttMs: number;
  measuredAtMs: number;
}
