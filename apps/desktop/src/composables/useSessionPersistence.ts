import { watch } from "vue";
import { useTargetsStore } from "@/stores/targets.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useConnectionStore } from "@/stores/connection.store";

const KEYS = {
  deviceSerial: "capubridge:device-serial",
  targetUrl: "capubridge:target-url",
  chromePort: "capubridge:chrome-port",
} as const;

export function useSessionPersistence() {
  const targetsStore = useTargetsStore();
  const devicesStore = useDevicesStore();
  const connectionStore = useConnectionStore();

  watch(
    () => devicesStore.selectedDevice,
    (device) => {
      if (device) localStorage.setItem(KEYS.deviceSerial, device.serial);
    },
  );

  watch(
    () => targetsStore.selectedTarget,
    (target) => {
      if (target) localStorage.setItem(KEYS.targetUrl, target.url);
    },
  );

  watch(
    () => devicesStore.devices,
    (devices) => {
      if (devicesStore.selectedDevice) return;
      const savedSerial = localStorage.getItem(KEYS.deviceSerial);
      if (!savedSerial) return;
      const match = devices.find((d) => d.serial === savedSerial && d.status === "online");
      if (match) devicesStore.selectDevice(match);
    },
  );

  watch(
    () => targetsStore.targets,
    async (targets) => {
      if (targetsStore.selectedTarget || connectionStore.activeConnection) return;

      const savedUrl = localStorage.getItem(KEYS.targetUrl);
      if (!savedUrl) return;

      const match = targets.find((t) => t.url === savedUrl);
      if (!match) return;

      targetsStore.selectTarget(match);
      try {
        await connectionStore.connect(match);
      } catch {
        // non-fatal
      }
    },
  );

  function saveChromePort(port: number) {
    localStorage.setItem(KEYS.chromePort, String(port));
  }

  function restoreChromePort(): number | null {
    const saved = localStorage.getItem(KEYS.chromePort);
    if (!saved) return null;
    const port = parseInt(saved, 10);
    return isNaN(port) ? null : port;
  }

  return { saveChromePort, restoreChromePort };
}
