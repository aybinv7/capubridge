import { formatClock } from "@/shared/components/timeline/stripFormat";
import type { LogcatStreamState } from "@/types/logcat.types";
import type { StreamStatusView } from "../list/streamView.types";

export interface LogsStatusInput {
  state: LogcatStreamState;
  liveSince: number | null;
  attempt: number;
}

/** The Logs stream's state as a dot and one word: live in the live colour, nothing else. */
export function logsStatus(input: LogsStatusInput): StreamStatusView {
  switch (input.state) {
    case "live":
      return {
        word: "Live",
        detail: input.liveSince === null ? null : `since ${formatClock(input.liveSince)}`,
        color: "lime",
        variant: "solid",
        pulse: false,
      };
    case "connecting":
      return { word: "Connecting", detail: null, color: undefined, variant: "hollow", pulse: true };
    case "reconnecting":
      return {
        word: "Reconnecting",
        detail: input.attempt > 1 ? `attempt ${input.attempt}` : null,
        color: "orange",
        variant: "solid",
        pulse: true,
      };
    case "stopped":
      return { word: "Stopped", detail: null, color: undefined, variant: "hollow", pulse: false };
  }
}
