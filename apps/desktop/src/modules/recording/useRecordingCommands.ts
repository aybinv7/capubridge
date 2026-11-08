import { CircleDot, Square } from "lucide-vue-next";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useRecordingStore } from "@/stores/recording.store";

interface RecordingCommandDeps {
  /** Opens the dialog that sets up a session recording. */
  configure: () => void;
  stop: () => void | Promise<void>;
}

/** Palette commands for the session recording the title bar's Record button starts and stops. */
export function useRecordingCommands(deps: RecordingCommandDeps) {
  const recording = useRecordingStore();
  useCommandProvider("global.recording", () => {
    if (recording.phase === "recording") {
      return [
        {
          id: "session.stop",
          title: "Stop and save the session",
          group: "Session" as const,
          icon: Square,
          keywords: ["recording", "record", "finish", "capu"],
          run: deps.stop,
        },
      ];
    }
    if (recording.phase !== "idle") return [];
    return [
      {
        id: "session.record",
        title: "Record a session…",
        group: "Session" as const,
        icon: CircleDot,
        keywords: ["recording", "record", "start", "capture", "replay", "capu"],
        run: deps.configure,
      },
    ];
  });
}
