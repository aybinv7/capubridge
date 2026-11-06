import type { DeviceClockOffset } from "@/types/timeline.types";

/** Offsets under this are within measurement noise and not worth showing. */
export const CLOCK_OFFSET_NOTICE_MS = 1_000;

/**
 * Converts a device wall-clock time to the host clock with a measured offset
 * (`hostMs = deviceMs - offsetMs`). Without a measurement the time is taken as is.
 */
export function deviceToHostMs(deviceMs: number, offset: DeviceClockOffset | null | undefined) {
  return offset ? deviceMs - offset.offsetMs : deviceMs;
}

/** A short description of the offset for a tooltip, or null when it is too small to matter. */
export function describeClockOffset(offset: DeviceClockOffset | null | undefined): string | null {
  if (!offset || Math.abs(offset.offsetMs) < CLOCK_OFFSET_NOTICE_MS) {
    return null;
  }
  const seconds = Math.abs(offset.offsetMs) / 1000;
  const amount = seconds >= 10 ? `${Math.round(seconds)} s` : `${seconds.toFixed(1)} s`;
  return offset.offsetMs > 0
    ? `Device clock is ${amount} ahead of this computer`
    : `Device clock is ${amount} behind this computer`;
}
