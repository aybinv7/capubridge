import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { useAdb } from "@/composables/useAdb";
import type { ADBDevice } from "@/types/adb.types";

export const useDevicesStore = defineStore("devices", () => {
  const devices = ref<ADBDevice[]>([]);
  const selectedDevice = ref<ADBDevice | null>(null);
  const isPolling = ref(false);
  const error = ref<string | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const { refreshDevices: fetchDevices } = useAdb();

  const onlineDevices = computed(() => devices.value.filter((d) => d.status === "online"));

  async function refreshDevices() {
    try {
      const result = await fetchDevices();
      devices.value = result;
      error.value = null;

      if (
        selectedDevice.value &&
        !devices.value.find((d) => d.serial === selectedDevice.value!.serial)
      ) {
        selectedDevice.value = null;
      }
    } catch (err) {
      error.value = String(err);
      console.error("ADB list devices error:", err);
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
    onlineDevices,
    refreshDevices,
    startPolling,
    stopPolling,
    selectDevice,
    setDevices,
  };
});
