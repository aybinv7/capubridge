import { Camera, CircleDot, Square } from "lucide-vue-next";
import { useCommandProvider } from "@/composables/useCommandProvider";

interface MirrorCommandDeps {
  /** Whether the stream is live, so a still or a recording can be taken. */
  canCapture: () => boolean;
  isRecording: () => boolean;
  screenshot: () => void | Promise<void>;
  toggleRecord: () => void;
}

/** Palette commands of the device screen column: a screenshot and a screen recording. */
export function useMirrorCommands(deps: MirrorCommandDeps) {
  useCommandProvider("screen.mirror", () => [
    {
      id: "mirror.screenshot",
      title: "Take a screenshot",
      group: "Session" as const,
      icon: Camera,
      keywords: ["capture", "screen", "image", "png", "phone"],
      when: deps.canCapture,
      run: deps.screenshot,
    },
    {
      id: "mirror.record",
      title: deps.isRecording() ? "Stop recording the screen" : "Record the screen",
      group: "Session" as const,
      icon: deps.isRecording() ? Square : CircleDot,
      keywords: ["video", "mp4", "capture", "phone", "stop"],
      when: deps.canCapture,
      run: deps.toggleRecord,
    },
  ]);
}
