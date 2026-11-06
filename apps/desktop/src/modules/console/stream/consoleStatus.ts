import { formatClock } from "@/shared/components/timeline/stripFormat";
import type { StreamStatusView } from "../list/streamView.types";

export type ConsoleCaptureState = "idle" | "connecting" | "live" | "error";

/** Console capture as a dot and one word: live in the live colour, a failure in red. */
export function consoleStatus(
  state: ConsoleCaptureState,
  liveSince: number | null,
): StreamStatusView {
  switch (state) {
    case "live":
      return {
        word: "Live",
        detail: liveSince === null ? null : `since ${formatClock(liveSince)}`,
        color: "lime",
        variant: "solid",
        pulse: false,
      };
    case "connecting":
      return { word: "Connecting", detail: null, color: undefined, variant: "hollow", pulse: true };
    case "error":
      return {
        word: "Not connected",
        detail: "retrying",
        color: "red",
        variant: "solid",
        pulse: false,
      };
    case "idle":
      return { word: "Idle", detail: null, color: undefined, variant: "hollow", pulse: false };
  }
}
