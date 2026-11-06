import type { Router } from "vue-router";
import { invokeCommand } from "@/runtime/ipc";

/**
 * Opens the saved recording `sessionId` in Replay at host time `atMs`. Resolves false when the
 * recording is not on disk (still being written, or deleted).
 */
export async function openRecordingAt(
  router: Router,
  sessionId: string,
  atMs: number,
): Promise<boolean> {
  const sessions = await invokeCommand("recording_list_sessions");
  const session = sessions.find((entry) => entry.sessionId === sessionId);
  if (!session) return false;
  const offset = Math.max(0, Math.round(atMs - session.startedAt));
  await router.push({ path: "/replay", query: { file: session.filePath, t: String(offset) } });
  return true;
}
