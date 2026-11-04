import type { Color } from "@capubridge/cladd";
import type { FrameReading } from "./mirrorFrameClock";

export type MirrorPhase = "off" | "starting" | "waiting" | "live" | "still" | "error";

export interface MirrorStatusInput {
  /** The panel wants a stream: open, attached, and not showing a local webview. */
  active: boolean;
  isConnected: boolean;
  error: string | null;
  frames: FrameReading;
}

export interface MirrorStatus {
  phase: MirrorPhase;
  label: string;
  /** Mono detail after the label: frame rate, or how long the picture has not changed. */
  meta: string | null;
  dotColor: Color | undefined;
  dotVariant: "solid" | "hollow";
  pulse: boolean;
  description: string;
}

/** A frame older than this means the picture has stopped changing. */
export const STILL_AFTER_MS = 1500;

export function deriveMirrorPhase(input: MirrorStatusInput): MirrorPhase {
  if (input.error) return "error";
  if (!input.active) return "off";
  if (!input.isConnected) return "starting";
  if (input.frames.ageMs === null) return "waiting";
  return input.frames.ageMs <= STILL_AFTER_MS ? "live" : "still";
}

export function formatFrameAge(ageMs: number): string {
  if (ageMs < 1000) return "<1 s";
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h`;
}

export function describeMirrorStatus(input: MirrorStatusInput): MirrorStatus {
  const phase = deriveMirrorPhase(input);
  switch (phase) {
    case "live":
      return {
        phase,
        label: "Live",
        meta: `${input.frames.fps} fps`,
        dotColor: "lime",
        dotVariant: "solid",
        pulse: false,
        description: "Frames are arriving from the device",
      };
    case "still":
      return {
        phase,
        label: "Unchanged",
        meta: formatFrameAge(input.frames.ageMs ?? 0),
        dotColor: undefined,
        dotVariant: "solid",
        pulse: false,
        description:
          "Connected. The device only sends a frame when the picture changes, so a still screen sends nothing.",
      };
    case "waiting":
      return {
        phase,
        label: "Waiting for a frame",
        meta: null,
        dotColor: "brand",
        dotVariant: "solid",
        pulse: true,
        description: "Connected; the first frame has not arrived yet",
      };
    case "starting":
      return {
        phase,
        label: "Starting",
        meta: null,
        dotColor: "brand",
        dotVariant: "solid",
        pulse: true,
        description: "Opening the screen stream",
      };
    case "error":
      return {
        phase,
        label: "Stopped",
        meta: null,
        dotColor: "red",
        dotVariant: "solid",
        pulse: false,
        description: describeMirrorError(input.error ?? "").title,
      };
    case "off":
      return {
        phase,
        label: "Off",
        meta: null,
        dotColor: undefined,
        dotVariant: "hollow",
        pulse: false,
        description: "No stream is running",
      };
  }
}

export interface MirrorErrorCopy {
  title: string;
  hint: string;
  detail: string;
}

const ERROR_COPY: Array<{ match: RegExp; title: string; hint: string }> = [
  {
    match: /unauthori[sz]ed/i,
    title: "USB debugging is not allowed yet",
    hint: "Accept the debugging prompt on the device, then restart.",
  },
  {
    match: /timeout waiting for scrcpy video|first decoded frame|no frame/i,
    title: "The device sent no picture",
    hint: "Wake and unlock the device, then restart the stream.",
  },
  {
    match: /webcodecs|codec not supported|decoder error|config check failed/i,
    title: "This computer cannot decode the stream",
    hint: "Open the stream in the scrcpy window from the screen menu instead.",
  },
  {
    match: /select target or online|no online android device|no chrome target|no android device/i,
    title: "No device to show",
    hint: "Pick an online device or a target from the context pill at the top.",
  },
  {
    match: /offline|not found|no devices|device .* gone|broken pipe|connection reset/i,
    title: "The device is not reachable",
    hint: "Check the cable or the Wi-Fi link, then restart the stream.",
  },
  {
    match: /disconnected/i,
    title: "The stream disconnected",
    hint: "Restart the stream to reconnect.",
  },
];

/** Turns a raw transport error into what happened and what to do next, keeping the raw text. */
export function describeMirrorError(raw: string): MirrorErrorCopy {
  const detail = raw.replace(/^(?:Ipc)?Error:\s*/i, "").trim();
  const known = ERROR_COPY.find((entry) => entry.match.test(detail));
  if (known) return { title: known.title, hint: known.hint, detail };
  return {
    title: "The screen stream stopped",
    hint: "Restart the stream. If it keeps failing, reconnect the device.",
    detail,
  };
}
