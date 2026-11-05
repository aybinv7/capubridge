import type { AppPresence } from "@/lib/gates/presence";
import type { NetworkCaptureStatus } from "../stores/useNetworkStore";

export interface CaptureInput {
  status: NetworkCaptureStatus;
  recording: boolean;
  presence: AppPresence;
  error: string | null;
}

export type CaptureTone = "live" | "neutral" | "warning" | "error";

export interface CaptureWord {
  label: string;
  tone: CaptureTone;
  solid: boolean;
  detail: string | null;
}

/**
 * The one word that says what capture is doing. Pausing is the person's choice and is said first;
 * an app in the background is said before "Live" because Android may have frozen it.
 */
export function captureWord(input: CaptureInput): CaptureWord {
  if (!input.recording) {
    return {
      label: "Paused",
      tone: "neutral",
      solid: false,
      detail: "New requests are not recorded",
    };
  }
  if (input.status === "error") {
    return {
      label: "Not capturing",
      tone: "error",
      solid: false,
      detail: input.error ? `Trying again. ${input.error}` : "Trying again",
    };
  }
  if (input.status === "connecting") {
    return { label: "Connecting", tone: "neutral", solid: false, detail: null };
  }
  if (input.status === "idle") {
    return { label: "Not capturing", tone: "neutral", solid: false, detail: null };
  }
  if (input.presence === "background") {
    return {
      label: "In the background",
      tone: "warning",
      solid: false,
      detail: "Android may freeze the app while it is away, so requests can stop arriving",
    };
  }
  return { label: "Live", tone: "live", solid: true, detail: null };
}

export type EmptyAction = "clear-filters" | "resume" | "reload" | null;

export interface EmptyCopy {
  title: string;
  text: string;
  action: EmptyAction;
}

export interface EmptyInput extends CaptureInput {
  captured: number;
  filtering: boolean;
}

/** What an empty list means, so it never looks like nothing happened when something did. */
export function emptyCopy(input: EmptyInput): EmptyCopy {
  if (input.captured > 0 && input.filtering) {
    return {
      title: "No requests match these filters",
      text: `${input.captured} ${input.captured === 1 ? "request is" : "requests are"} hidden by the search, type or method.`,
      action: "clear-filters",
    };
  }
  if (!input.recording) {
    return {
      title: "Capture is paused",
      text: "Requests the app makes now are not recorded. Resume to see them.",
      action: "resume",
    };
  }
  if (input.status === "error") {
    return {
      title: "Could not start capturing",
      text: input.error
        ? `Capubridge keeps trying on its own. ${input.error}`
        : "Capubridge keeps trying on its own.",
      action: null,
    };
  }
  if (input.status === "connecting" || input.status === "idle") {
    return {
      title: "Connecting to the app",
      text: "Requests appear here as soon as capture starts.",
      action: null,
    };
  }
  if (input.presence === "background") {
    return {
      title: "No requests while the app is in the background",
      text: "They start arriving again once the app is back on screen.",
      action: null,
    };
  }
  return {
    title: "Waiting for the app to make a request",
    text: "Requests appear as the app makes them. Reload the page to see everything from the start.",
    action: "reload",
  };
}
