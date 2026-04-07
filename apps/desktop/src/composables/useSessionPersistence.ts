import { watch } from "vue";
import type { Ref } from "vue";
import { useTargetsStore } from "@/stores/targets.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useConnectionStore } from "@/stores/connection.store";

const KEYS = {
  sourceMode: "capubridge:source-mode",
  deviceSerial: "capubridge:device-serial",
  targetUrl: "capubridge:target-url",
} as const;

export function useSessionPersistence(sourceMode: Ref<"device" | "chrome">) {
  const targetsStore = useTargetsStore();
  const devicesStore = useDevicesStore();
  const connectionStore = useConnectionStore();

  // ─── Persist on change ──────────────────────────────────────────────────────
  watch(sourceMode, (mode) => {
    localStorage.setItem(KEYS.sourceMode, mode);
  });

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

  // ─── Auto-select device when device list loads/changes ──────────────────────
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

  // ─── Auto-select + connect target when target list loads/changes ────────────
  watch(
    () => targetsStore.targets,
    async (targets) => {
      if (targetsStore.selectedTarget) return;
      const savedUrl = localStorage.getItem(KEYS.targetUrl);
      if (!savedUrl) return;
      const match = targets.find((t) => t.url === savedUrl);
      if (!match) return;
      targetsStore.selectTarget(match);
      try {
        await connectionStore.connect(match);
      } catch {
        // Connection failure is non-fatal — user can retry
      }
    },
  );

  // ─── Restore helpers ─────────────────────────────────────────────────────────
  function restoreSourceMode(): "device" | "chrome" {
    return (localStorage.getItem(KEYS.sourceMode) as "device" | "chrome") ?? "device";
  }

  return { restoreSourceMode };
}
