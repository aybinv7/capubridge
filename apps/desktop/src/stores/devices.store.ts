import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { useAdb } from "@/composables/useAdb";
import type { ADBDevice } from "@/types/adb.types";

export type AdbServerStatus = "unknown" | "running" | "starting" | "error";

export const useDevicesStore = defineStore("devices", () => {
  const devices = ref<ADBDevice[]>([]);
  const selectedDevice = ref<ADBDevice | null>(null);
  const isPolling = ref(false);
  const error = ref<string | null>(null);
  const adbServerStatus = ref<AdbServerStatus>("unknown");

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let serverStartPromise: Promise<boolean> | null = null;
  let refreshInFlight = false;

  const { refreshDevices: fetchDevices } = useAdb();

  const onlineDevices = computed(() => devices.value.filter((d) => d.status === "online"));

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

    adbServerStatus.value = "starting";
    serverStartPromise = (invoke("adb_start_server") as Promise<string>)
      .then(() => {
        adbServerStatus.value = "running";
        return true;
      })
      .catch(() => {
        adbServerStatus.value = "error";
        return false;
      })
      .finally(() => {
        serverStartPromise = null;
      });

    return serverStartPromise;
  }

  async function refreshDevices() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      const result = await fetchDevices();
      devices.value = result;
      error.value = null;
      if (adbServerStatus.value !== "running") {
        adbServerStatus.value = "running";
      }

      if (
        selectedDevice.value &&
        !devices.value.find((d) => d.serial === selectedDevice.value!.serial)
      ) {
        selectedDevice.value = null;
      }
    } catch (err) {
      const msg = String(err);
      if (isConnectionError(msg)) {
        const ok = await startServer();
        if (ok) {
          try {
            const result = await fetchDevices();
            devices.value = result;
            error.value = null;
          } catch (retryErr) {
            error.value = String(retryErr);
          }
        }
      } else {
        error.value = msg;
        console.error("ADB list devices error:", err);
      }
    } finally {
      refreshInFlight = false;
    }
  }

  function startPolling(intervalMs = 3000) {
    if (isPolling.value) return;
    isPolling.value = true;
    void refreshDevices();
    pollTimer = setInterval(() => void refreshDevices(), intervalMs);
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    isPolling.value = false;
  }

  function selectDevice(device: ADBDevice) {
    selectedDevice.value = device;
  }

  function setDevices(newDevices: ADBDevice[]) {
    devices.value = newDevices;
  }

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
