import { effectScope, watch } from "vue";
import { invokeCommand } from "@/runtime/ipc/client";
import { useRecordingStore } from "@/stores/recording.store";
import { useConsoleStore } from "@/stores/console.store";
import { useSessionWriter } from "./useSessionWriter";
import { useRrwebRecorder } from "./useRrwebRecorder";
import { useNetworkRecorder } from "./useNetworkRecorder";
import { usePerfRecorder } from "./usePerfRecorder";
import { useLocalStorageRecorder } from "./useLocalStorageRecorder";
import { useIndexedDBRecorder } from "./useIndexedDBRecorder";
import { useSqliteRecorder } from "./useSqliteRecorder";
import { useCDP } from "./useCDP";
import type { RecordingConfig, SessionManifest, ConsoleArgRecord } from "@/types/replay.types";
import type { ConsoleArg } from "@/types/console.types";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";
import { toast } from "vue-sonner";
import type { CDPClient } from "@capubridge/cdp-protocol";
import { recordingDeadline } from "./recordingDeadline";

let writer: ReturnType<typeof useSessionWriter> | null = null;
let rrwebRecorder: ReturnType<typeof useRrwebRecorder> | null = null;
let networkRecorder: ReturnType<typeof useNetworkRecorder> | null = null;
let perfRecorder: ReturnType<typeof usePerfRecorder> | null = null;
let localStorageRecorder: ReturnType<typeof useLocalStorageRecorder> | null = null;
let indexedDBRecorder: ReturnType<typeof useIndexedDBRecorder> | null = null;
let sqliteRecorder: ReturnType<typeof useSqliteRecorder> | null = null;
let consoleUnwatch: (() => void) | null = null;
let connectionUnwatch: (() => void) | null = null;
let consoleLeasedByRecorder = false;
let startedAt = 0;
let activeSessionId = "";
let captureErrors: string[] = [];

const recordingScope = effectScope(true);

function generateSessionId(): string {
  return `capu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function argToRecord(a: ConsoleArg): ConsoleArgRecord {
  if (a.kind === "primitive") return { kind: "primitive", text: a.text };
  return {
    kind: "object",
    description: a.description,
    subtype: a.subtype,
    overflow: a.overflow,
    properties: a.properties.map((p) => ({ name: p.name, value: argToRecord(p.value) })),
  };
}

export function useRecordingSession() {
  const recordingStore = useRecordingStore();
  const consoleStore = useConsoleStore();
  const devicesStore = useDevicesStore();
  const targetsStore = useTargetsStore();
  const { activeClient, connectToTarget, connectionStore } = useCDP();

  async function ensureCdpClient(): Promise<CDPClient | null> {
    const selectedTarget = targetsStore.selectedTarget;
    if (
      selectedTarget &&
      selectedTarget.webSocketDebuggerUrl &&
      connectionStore.selectedTargetId !== selectedTarget.id
    ) {
      return connectToTarget(selectedTarget);
    }

    if (activeClient.value) {
      return activeClient.value;
    }

    if (selectedTarget?.webSocketDebuggerUrl) {
      return connectToTarget(selectedTarget);
    }

    return null;
  }

  async function start(config: RecordingConfig): Promise<void> {
    if (recordingStore.isRecording) return;

    const sessionId = generateSessionId();
    startedAt = Date.now();
    activeSessionId = sessionId;
    captureErrors = [];

    recordingStore.setConfig(config);

    try {
      await invokeCommand("recording_session_start", { sessionId });
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

    let cdpClient: CDPClient | null = null;
    if (
      config.tracks.network ||
      config.tracks.rrweb ||
      config.databaseTracks?.localStorage ||
      config.databaseTracks?.indexedDB
    ) {
      try {
        cdpClient = await ensureCdpClient();
      } catch (err) {
        const msg = `CDP connection failed: ${String(err)}`;
        console.error("[recording]", msg);
        toast.error(msg);
      }
    }

    const recordedTargetId = connectionStore.selectedTargetId;
    if (cdpClient && recordedTargetId) {
      connectionUnwatch?.();
      connectionUnwatch = watch(
        () => connectionStore.connections.get(recordedTargetId)?.status,
        (status, previousStatus) => {
          if (
            previousStatus === "connected" &&
            (status === "disconnected" || status === "error") &&
            recordingStore.isRecording
          ) {
            captureErrors.push("connection: target disconnected");
            toast.warning("Recording stopped because the target disconnected");
            void stop();
          }
        },
      );
    }

    if (config.tracks.network) {
      if (!cdpClient) {
        captureErrors.push("network: no CDP target connected");
        toast.warning("Network track skipped: no CDP target connected");
      } else {
        networkRecorder = useNetworkRecorder(cdpClient, writer);
        try {
          await networkRecorder.start();
          console.log("[recording] network recorder started");
        } catch (err) {
          const msg = `Network recorder failed: ${String(err)}`;
          console.error("[recording]", msg);
          toast.error(msg);
          captureErrors.push(`network: ${String(err)}`);
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
                  id: entry.id,
                  parentId: entry.parentId,
                  isGroup: entry.isGroup,
                  groupCollapsed: entry.groupCollapsed,
                  args: (entry.args ?? []).map(argToRecord),
                },
                entry.timestamp ?? startedAt,
              );
            }
          },
        );
      });
    }

    if (config.tracks.perf) {
      const serial = devicesStore.selectedDevice?.serial;
      if (!serial) {
        captureErrors.push("performance: no device selected");
        toast.warning("Performance track skipped: no device selected");
      } else {
        perfRecorder = usePerfRecorder(serial, cdpClient ?? activeClient.value, writer, startedAt);
        try {
          await perfRecorder.start();
          console.log("[recording] perf recorder started");
        } catch (err) {
          const msg = `Perf recorder failed: ${String(err)}`;
          console.error("[recording]", msg);
          toast.error(msg);
          captureErrors.push(`performance: ${String(err)}`);
          perfRecorder = null;
        }
      }
    }

    if (config.tracks.databases && config.databaseTracks?.localStorage) {
      if (!cdpClient) {
        captureErrors.push("LocalStorage: no CDP target connected");
        toast.warning("LocalStorage capture skipped: no CDP target connected");
      } else {
        localStorageRecorder = useLocalStorageRecorder(cdpClient, writer);
        try {
          await localStorageRecorder.start();
        } catch (err) {
          const msg = `LocalStorage recorder failed: ${String(err)}`;
          console.error("[recording]", msg);
          toast.error(msg);
          captureErrors.push(`LocalStorage: ${String(err)}`);
          localStorageRecorder = null;
        }
      }
    }

    if (config.tracks.databases && config.databaseTracks?.indexedDB) {
      if (!cdpClient) {
        captureErrors.push("IndexedDB: no CDP target connected");
        toast.warning("IndexedDB capture skipped: no CDP target connected");
      } else {
        indexedDBRecorder = useIndexedDBRecorder(cdpClient, sessionId, startedAt);
        try {
          await indexedDBRecorder.start();
        } catch (err) {
          const msg = `IndexedDB recorder failed: ${String(err)}`;
          console.error("[recording]", msg);
          toast.error(msg);
          captureErrors.push(`IndexedDB: ${String(err)}`);
          indexedDBRecorder = null;
        }
      }
    }

    if (config.tracks.databases && config.databaseTracks?.sqlite) {
      const serial =
        devicesStore.selectedDevice?.serial ?? targetsStore.selectedTarget?.deviceSerial ?? "";
      const packageName =
        targetsStore.selectedTarget?.source === "adb"
          ? (targetsStore.selectedTarget.packageName?.trim() ?? "")
          : "";
      if (!serial || !packageName) {
        captureErrors.push("SQLite: no Android package target selected");
        toast.warning("SQLite capture skipped: no Android package target selected");
      } else {
        sqliteRecorder = useSqliteRecorder(sessionId, startedAt, serial, packageName);
        try {
          await sqliteRecorder.start();
        } catch (err) {
          const msg = `SQLite recorder failed: ${String(err)}`;
          console.error("[recording]", msg);
          toast.error(msg);
          captureErrors.push(`SQLite: ${String(err)}`);
          sqliteRecorder = null;
        }
      }
    }

    if (config.tracks.rrweb) {
      if (!cdpClient) {
        captureErrors.push("DOM: no CDP target connected");
        toast.warning("DOM track skipped: no CDP target connected");
      } else {
        rrwebRecorder = useRrwebRecorder(cdpClient, writer);
        try {
          await rrwebRecorder.start({ reloadTarget: config.reloadTarget });
        } catch (err) {
          const msg = `rrweb start failed: ${String(err)}`;
          console.error("[recording]", msg);
          toast.error(msg);
          captureErrors.push(`DOM: ${String(err)}`);
          try {
            await rrwebRecorder.stop();
          } catch (cleanupError) {
            console.warn("[recording] rrweb cleanup failed", cleanupError);
          }
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

    connectionUnwatch?.();
    connectionUnwatch = null;

    const finalizationErrors = [...captureErrors];
    async function finalizeCapture(name: string, capture: { stop: () => Promise<void> } | null) {
      if (!capture) return;
      try {
        await recordingDeadline(capture.stop(), `${name} finalization`);
      } catch (error) {
        finalizationErrors.push(name + ": " + String(error));
      }
    }

    await finalizeCapture("DOM", rrwebRecorder);
    rrwebRecorder = null;
    await finalizeCapture("network", networkRecorder);
    networkRecorder = null;
    await finalizeCapture("performance", perfRecorder);
    perfRecorder = null;
    await finalizeCapture("LocalStorage", localStorageRecorder);
    localStorageRecorder = null;
    await finalizeCapture("IndexedDB", indexedDBRecorder);
    indexedDBRecorder = null;
    await finalizeCapture("SQLite", sqliteRecorder);
    sqliteRecorder = null;

    try {
      consoleUnwatch?.();
    } catch (error) {
      console.warn("[recording] failed to stop console watcher", error);
    }
    consoleUnwatch = null;

    if (consoleLeasedByRecorder) {
      consoleLeasedByRecorder = false;
      try {
        await consoleStore.releaseLease();
      } catch (error) {
        console.warn("[recording] failed to release console lease", error);
      }
    }

    try {
      if (writer) await recordingDeadline(writer.stop(), "Writer finalization");
    } catch (error) {
      finalizationErrors.push("writer: " + String(error));
    }
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
      tracks: recordingStore.config?.tracks ?? {
        rrweb: false,
        network: false,
        console: false,
        perf: false,
        databases: false,
      },
      databaseTracks: recordingStore.config?.databaseTracks,
      incomplete:
        finalizationErrors.length > 0
          ? {
              errors: finalizationErrors,
              missingTracks: finalizationErrors.map((error) => error.split(":", 1)[0]),
            }
          : undefined,
    };

    let capuPath: string | null = null;
    try {
      capuPath = await recordingDeadline(
        invokeCommand("recording_session_stop", {
          sessionId,
          manifestJson: JSON.stringify(manifest),
        }),
        "Archive finalization",
        20_000,
      );
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
    if (finalizationErrors.length > 0) {
      toast.warning("Recording saved as incomplete", {
        description: finalizationErrors.join("; "),
      });
    }
    recordingStore.reset();
    return capuPath;
  }

  return { start, stop };
}
