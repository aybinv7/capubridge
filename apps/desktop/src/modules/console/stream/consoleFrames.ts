import { isAppFrame } from "@/lib/console/consoleErrors";
import type { StackLine } from "@/lib/stream-rows/foldStack";
import type { StackFrame } from "@/types/console.types";

/** JavaScript frames as stack lines, the app's own frames marked for emphasis. */
export function jsStackLines(frames: readonly StackFrame[], appOrigin: string | null): StackLine[] {
  return frames.map((frame) => ({
    text: `  at ${frame.functionName || "(anonymous)"} (${frame.source})`,
    frame: true,
    app: isAppFrame(frame, appOrigin),
  }));
}
