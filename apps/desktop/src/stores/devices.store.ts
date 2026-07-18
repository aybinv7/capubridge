import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import type { ADBDevice } from "@/types/adb.types";
import { invokeCommand } from "@/runtime/ipc/client";
import { useSessionStore } from "@/stores/session.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useConnectionStore } from "@/stores/connection.store";
import { saveSelectedDeviceSerial } from "@/composables/useSessionPersistence";

export type AdbServerStatus = "unknown" | "running" | "starting" | "error";

export const useDevicesStore = defineStore("devices", () => {
  const sessionStore = useSessionStore();
  const targetsStore = useTargetsStore();
  const connectionStore = useConnectionStore();
  const isPolling = ref(false);
  const error = ref<string | null>(null);
  const statusOverride = ref<AdbServerStatus | null>(null);

  let serverStartPromise: Promise<boolean> | null = null;
  const devices = computed(() => sessionStore.devices);
  const selectedDevice = computed(() => sessionStore.selectedDevice);
  const onlineDevices = computed(() => sessionStore.onlineDevices);
  const adbServerStatus = computed<AdbServerStatus>(() => {
    if (statusOverride.value) {
      return statusOverride.value;
    }
    if (!sessionStore.isInitialized) {
      return "unknown";
    }
    if (sessionStore.trackerStatus === "starting") {
      return "starting";
    }
    if (sessionStore.trackerStatus === "running") {
      return "running";
    }
    if (sessionStore.trackerStatus === "error") {
      return "error";
    }
    return "unknown";
  });

  watch(
    () => sessionStore.lastError,
    (nextError) => {
      if (nextError) {
        error.value = nextError;
      }
    },
  );

  watch(
    () => sessionStore.trackerStatus,
    (status) => {
      if (status === "running" || status === "error") {
        statusOverride.value = null;
      }
    },
  );

  function isConnectionError(msg: string): boolean {
    return (
      msg.includes("refused") ||
      msg.includes("10061") ||
      msg.includes("NotConnected") ||
      msg.includes("Connection refused")
    );
  }

  async function startServer(): Promise<boolean> {
    if (serverStartPromise) {
      return serverStartPromise;
    }

    statusOverride.value = "starting";
    serverStartPromise = invokeCommand("adb_start_server")
      .then(() => {
        statusOverride.value = "running";
        return true;
      })
      .catch((error) => {
        statusOverride.value = "error";
        console.warn("Failed to start ADB server", error);
        return false;
      })
      .finally(() => {
        serverStartPromise = null;
      });

    return serverStartPromise;
  }

  async function refreshDevices() {
    await sessionStore.initialize();
    try {
      await sessionStore.refreshDevices();
      error.value = null;
    } catch (err) {
      const msg = String(err);
      if (isConnectionError(msg)) {
        const ok = await startServer();
        if (ok) {
          try {
            await sessionStore.refreshDevices();
            error.value = null;
          } catch (retryErr) {
            error.value = String(retryErr);
            throw retryErr;
          }
        } else {
          error.value = msg;
          throw err;
        }
      } else {
        error.value = msg;
        console.error("ADB list devices error:", err);
        throw err;
      }
    }
  }

  function startPolling(intervalMs = 3000) {
    void intervalMs;
    isPolling.value = true;
    void sessionStore.initialize();
    void refreshDevices();
  }

  function stopPolling() {
    isPolling.value = false;
  }

  async function selectDevice(device: ADBDevice) {
    const activeAdbTarget =
      targetsStore.selectedTarget?.source === "adb" ? targetsStore.selectedTarget : null;

    if (activeAdbTarget && activeAdbTarget.deviceSerial !== device.serial) {
      await connectionStore.disconnectTarget(activeAdbTarget.id);
      if (targetsStore.selectedTarget?.source === "adb") {
        targetsStore.selectTarget(null);
      }
    }

    await sessionStore.setActiveDevice(device.serial);
    saveSelectedDeviceSerial(device.serial);
    if (device.status === "online") {
      await targetsStore.hydrateAdbTargets(device.serial);
    }
  }

  function setDevices(_newDevices: ADBDevice[]) {}

  return {
    devices,
    selectedDevice,
    isPolling,
    error,
    adbServerStatus,
    onlineDevices,
    refreshDevices,
    startPolling,
    stopPolling,
    selectDevice,
    setDevices,
  };
});
