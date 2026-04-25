import { invoke } from "@tauri-apps/api/core";
import { watch } from "vue";
import { useRecordingStore } from "@/stores/recording.store";
import { useNetworkStore } from "@/modules/network/stores/useNetworkStore";
import { useConsoleStore } from "@/stores/console.store";
import { useSessionWriter } from "./useSessionWriter";
import { useRrwebRecorder } from "./useRrwebRecorder";
import { useCDP } from "./useCDP";
import type { RecordingConfig, SessionManifest } from "@/types/replay.types";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";
import { toast } from "vue-sonner";

function generateSessionId(): string {
  return `capu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Orchestrates a full recording session.
 *
 * Call start(config) to begin. Call stop() to finalize and get the .capu path.
 * The recording store reflects the current phase throughout.
 */
export function useRecordingSession() {
  const recordingStore = useRecordingStore();
  const networkStore = useNetworkStore();
  const consoleStore = useConsoleStore();
  const devicesStore = useDevicesStore();
  const targetsStore = useTargetsStore();
  const { activeClient } = useCDP();

  let writer: ReturnType<typeof useSessionWriter> | null = null;
  let rrwebRecorder: ReturnType<typeof useRrwebRecorder> | null = null;
  let networkUnwatch: (() => void) | null = null;
  let consoleUnwatch: (() => void) | null = null;
  let startedAt = 0;
  let activeSessionId = "";

  async function start(config: RecordingConfig): Promise<void> {
    if (recordingStore.isRecording) return;

    const sessionId = generateSessionId();
    startedAt = Date.now();
    activeSessionId = sessionId;

    recordingStore.setConfig(config);

    // 1. Tell Rust to create the session directory FIRST — only transition to
    //    "recording" phase after Rust confirms success to avoid a false-positive
    //    recording indicator in the UI.
    try {
      await invoke<void>("recording_session_start", { sessionId });
    } catch (err) {
      recordingStore.setError(`Failed to start session: ${String(err)}`);
      return;
    }

    recordingStore.setPhase("recording", sessionId);

    // 2. Start the event writer
    writer = useSessionWriter(sessionId, startedAt);
    writer.start();

    // 3. Wire network track
    if (config.tracks.network) {
      const seenIds = new Set<string>();
      networkUnwatch = watch(
        () => networkStore.allEntries,
        (entries) => {
          for (const entry of entries) {
            if (seenIds.has(entry.requestId)) continue;
            seenIds.add(entry.requestId);
            writer!.pushAt(
              "network",
              {
                requestId: entry.requestId,
                url: entry.url,
                method: entry.method,
                status: entry.httpStatus,
                resourceType: entry.resourceType,
                duration:
                  entry.finishedTimestamp && entry.startedAt
                    ? entry.finishedTimestamp - entry.startedAt
                    : null,
                transferSize: entry.transferSize,
                state: entry.state,
              },
              entry.startedAt ?? startedAt,
            );
          }
        },
        { immediate: false },
      );
    }

    // 4. Wire console track — watch entries array length and drain new entries
    if (config.tracks.console) {
      let lastConsoleIndex = consoleStore.entries.length;
      consoleUnwatch = watch(
        () => consoleStore.entries.length,
        () => {
          const newEntries = consoleStore.entries.slice(lastConsoleIndex);
          lastConsoleIndex = consoleStore.entries.length;
          for (const entry of newEntries) {
            writer!.pushAt(
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
    }

    // 5. Wire rrweb track
    if (config.tracks.rrweb && activeClient.value) {
      rrwebRecorder = useRrwebRecorder(activeClient.value, writer);
      try {
        await rrwebRecorder.start({ reloadTarget: config.reloadTarget });
      } catch (err) {
        toast.error(`rrweb injection failed: ${String(err)}`);
        // Non-fatal — continue recording other tracks
      }
    }
  }

  async function stop(): Promise<string | null> {
    if (!recordingStore.isRecording) return null;
    recordingStore.setPhase("stopping");

    // 1. Stop rrweb first (removes script injection)
    await rrwebRecorder?.stop();
    rrwebRecorder = null;

    // 2. Unwatch network/console
    networkUnwatch?.();
    networkUnwatch = null;
    consoleUnwatch?.();
    consoleUnwatch = null;

    // 3. Flush remaining events to Rust
    await writer?.stop();
    writer = null;

    // 4. Build manifest
    const manifest: SessionManifest = {
      version: 1,
      sessionId: activeSessionId,
      label: recordingStore.config?.label ?? "Unnamed session",
      startedAt,
      duration: Date.now() - startedAt,
      deviceSerial: devicesStore.selectedDevice?.serial ?? null,
      targetUrl: targetsStore.selectedTarget?.url ?? null,
      appPackage: null,
      tracks: recordingStore.config?.tracks ?? { rrweb: false, network: false, console: false },
    };

    // 5. Tell Rust to finalize the zip
    let capuPath: string | null = null;
    try {
      capuPath = await invoke<string>("recording_session_stop", {
        sessionId: activeSessionId,
        manifestJson: JSON.stringify(manifest),
      });
    } catch (err) {
      recordingStore.setError(`Failed to package session: ${String(err)}`);
      return null;
    }

    recordingStore.reset();
    return capuPath;
  }

  return { start, stop };
}
