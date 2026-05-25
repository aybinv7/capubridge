import { invoke } from "@tauri-apps/api/core";
import { effectScope, watch } from "vue";
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
import type { CDPClient } from "utils";

let writer: ReturnType<typeof useSessionWriter> | null = null;
let rrwebRecorder: ReturnType<typeof useRrwebRecorder> | null = null;
let networkRecorder: ReturnType<typeof useNetworkRecorder> | null = null;
let perfRecorder: ReturnType<typeof usePerfRecorder> | null = null;
let localStorageRecorder: ReturnType<typeof useLocalStorageRecorder> | null = null;
let indexedDBRecorder: ReturnType<typeof useIndexedDBRecorder> | null = null;
let sqliteRecorder: ReturnType<typeof useSqliteRecorder> | null = null;
let consoleUnwatch: (() => void) | null = null;
let consoleLeasedByRecorder = false;
let startedAt = 0;
let activeSessionId = "";

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

    if (config.tracks.network) {
      if (!cdpClient) {
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
          perfRecorder = null;
        }
      }
    }

    if (config.tracks.databases && config.databaseTracks?.localStorage) {
      if (!cdpClient) {
        toast.warning("LocalStorage capture skipped: no CDP target connected");
      } else {
        localStorageRecorder = useLocalStorageRecorder(cdpClient, writer);
        try {
          await localStorageRecorder.start();
        } catch (err) {
          const msg = `LocalStorage recorder failed: ${String(err)}`;
          console.error("[recording]", msg);
          toast.error(msg);
          localStorageRecorder = null;
        }
      }
    }

    if (config.tracks.databases && config.databaseTracks?.indexedDB) {
      if (!cdpClient) {
        toast.warning("IndexedDB capture skipped: no CDP target connected");
      } else {
        indexedDBRecorder = useIndexedDBRecorder(cdpClient, sessionId, startedAt);
        try {
          await indexedDBRecorder.start();
        } catch (err) {
          const msg = `IndexedDB recorder failed: ${String(err)}`;
          console.error("[recording]", msg);
          toast.error(msg);
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
        toast.warning("SQLite capture skipped: no Android package target selected");
      } else {
        sqliteRecorder = useSqliteRecorder(sessionId, startedAt, serial, packageName);
        try {
          await sqliteRecorder.start();
        } catch (err) {
          const msg = `SQLite recorder failed: ${String(err)}`;
          console.error("[recording]", msg);
          toast.error(msg);
          sqliteRecorder = null;
        }
      }
    }

    if (config.tracks.rrweb) {
      if (!cdpClient) {
        toast.warning("DOM track skipped: no CDP target connected");
      } else {
        rrwebRecorder = useRrwebRecorder(cdpClient, writer);
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

    await perfRecorder?.stop();
    perfRecorder = null;

    await localStorageRecorder?.stop();
    localStorageRecorder = null;

    await indexedDBRecorder?.stop();
    indexedDBRecorder = null;

    await sqliteRecorder?.stop();
    sqliteRecorder = null;

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
      tracks: recordingStore.config?.tracks ?? {
        rrweb: false,
        network: false,
        console: false,
        perf: false,
        databases: false,
      },
      databaseTracks: recordingStore.config?.databaseTracks,
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
