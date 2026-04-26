import { invoke } from "@tauri-apps/api/core";
import { effectScope, watch } from "vue";
import { useRecordingStore } from "@/stores/recording.store";
import { useConsoleStore } from "@/stores/console.store";
import { useSessionWriter } from "./useSessionWriter";
import { useRrwebRecorder } from "./useRrwebRecorder";
import { useNetworkRecorder } from "./useNetworkRecorder";
import { useCDP } from "./useCDP";
import type { RecordingConfig, SessionManifest } from "@/types/replay.types";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";
import { toast } from "vue-sonner";

let writer: ReturnType<typeof useSessionWriter> | null = null;
let rrwebRecorder: ReturnType<typeof useRrwebRecorder> | null = null;
let networkRecorder: ReturnType<typeof useNetworkRecorder> | null = null;
let consoleUnwatch: (() => void) | null = null;
let consoleLeasedByRecorder = false;
let startedAt = 0;
let activeSessionId = "";

const recordingScope = effectScope(true);

function generateSessionId(): string {
  return `capu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useRecordingSession() {
  const recordingStore = useRecordingStore();
  const consoleStore = useConsoleStore();
  const devicesStore = useDevicesStore();
  const targetsStore = useTargetsStore();
  const { activeClient } = useCDP();

  async function start(config: RecordingConfig): Promise<void> {
    if (recordingStore.isRecording) return;

    const sessionId = generateSessionId();
    startedAt = Date.now();
    activeSessionId = sessionId;

    recordingStore.setConfig(config);

    try {
      await invoke<void>("recording_session_start", { sessionId });
    } catch (err) {
      activeSessionId = "";
      const msg = `Failed to start session: ${String(err)}`;
      console.error("[recording]", msg);
      recordingStore.setError(msg);
      toast.error(msg);
      return;
    }

    recordingStore.setPhase("recording", sessionId);
    console.log("[recording] session started", sessionId, "tracks:", config.tracks);

    writer = useSessionWriter(sessionId, startedAt);
    writer.start();

    if (config.tracks.network) {
      if (!activeClient.value) {
        toast.warning("Network track skipped: no CDP target connected");
      } else {
        networkRecorder = useNetworkRecorder(activeClient.value, writer);
        try {
          await networkRecorder.start();
          console.log("[recording] network recorder started");
        } catch (err) {
          const msg = `Network recorder failed: ${String(err)}`;
          console.error("[recording]", msg);
          toast.error(msg);
          networkRecorder = null;
        }
      }
    }

    if (config.tracks.console) {
      try {
        await consoleStore.acquireLease();
        consoleLeasedByRecorder = true;
        console.log("[recording] console lease acquired");
      } catch (err) {
        console.warn("[recording] console lease failed", err);
      }

      let lastConsoleIndex = consoleStore.entries.length;
      recordingScope.run(() => {
        consoleUnwatch = watch(
          () => consoleStore.entries.length,
          () => {
            const newEntries = consoleStore.entries.slice(lastConsoleIndex);
            lastConsoleIndex = consoleStore.entries.length;
            for (const entry of newEntries) {
              writer?.pushAt(
                "console",
                {
                  level: entry.level ?? "log",
                  text: entry.message ?? "",
                  source: entry.source ?? null,
                  line: entry.lineNumber ?? null,
                },
                entry.timestamp ?? startedAt,
              );
            }
          },
        );
      });
    }

    if (config.tracks.rrweb) {
      if (!activeClient.value) {
        toast.warning("DOM track skipped: no CDP target connected");
      } else {
        rrwebRecorder = useRrwebRecorder(activeClient.value, writer);
        try {
          await rrwebRecorder.start({ reloadTarget: config.reloadTarget });
        } catch (err) {
          const msg = `rrweb start failed: ${String(err)}`;
          console.error("[recording]", msg);
          toast.error(msg);
          rrwebRecorder = null;
        }
      }
    }
  }

  async function stop(): Promise<string | null> {
    if (!recordingStore.isRecording) return null;
    if (!activeSessionId) {
      recordingStore.reset();
      return null;
    }

    recordingStore.setPhase("stopping");

    const sessionId = activeSessionId;
    const sessionStartedAt = startedAt;
    console.log("[recording] stopping", sessionId);

    await rrwebRecorder?.stop();
    rrwebRecorder = null;

    await networkRecorder?.stop();
    networkRecorder = null;

    consoleUnwatch?.();
    consoleUnwatch = null;

    if (consoleLeasedByRecorder) {
      consoleLeasedByRecorder = false;
      try {
        await consoleStore.releaseLease();
      } catch {
        void 0;
      }
    }

    await writer?.stop();
    writer = null;

    const manifest: SessionManifest = {
      version: 1,
      sessionId,
      label: recordingStore.config?.label ?? "Unnamed session",
      startedAt: sessionStartedAt,
      duration: Date.now() - sessionStartedAt,
      deviceSerial: devicesStore.selectedDevice?.serial ?? null,
      targetUrl: targetsStore.selectedTarget?.url ?? null,
      appPackage: null,
      tracks: recordingStore.config?.tracks ?? { rrweb: false, network: false, console: false },
    };

    let capuPath: string | null = null;
    try {
      capuPath = await invoke<string>("recording_session_stop", {
        sessionId,
        manifestJson: JSON.stringify(manifest),
      });
      console.log("[recording] saved", capuPath);
    } catch (err) {
      const msg = `Failed to package session: ${String(err)}`;
      console.error("[recording]", msg);
      recordingStore.setError(msg);
      toast.error(msg);
      activeSessionId = "";
      startedAt = 0;
      return null;
    }

    activeSessionId = "";
    startedAt = 0;
    recordingStore.reset();
    return capuPath;
  }

  return { start, stop };
}
