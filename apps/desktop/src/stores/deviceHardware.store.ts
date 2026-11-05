import { ref, watch } from "vue";
import { defineStore } from "pinia";
import type { ADBDevice } from "@/types/adb.types";
import { useAdb } from "@/composables/useAdb";
import { readPersisted, writePersisted } from "@/lib/persisted";
import { useSessionStore } from "@/stores/session.store";

const LS_HARDWARE_SERIALS = "capubridge:device-hardware-serials";
const SERIAL_COMMAND = "getprop ro.serialno";

function isSerialMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

/**
 * Which handset each ADB connection reaches. A USB serial already is the handset's serial; a
 * Wi-Fi address is not, so it is asked once while online and remembered, which lets the device
 * list show one handset however many ways it was ever connected.
 */
export const useDeviceHardwareStore = defineStore("deviceHardware", () => {
  const sessionStore = useSessionStore();
  const { shellCommand } = useAdb();
  const serials = ref<Record<string, string>>(
    readPersisted<Record<string, string>>(LS_HARDWARE_SERIALS, {}, isSerialMap),
  );
  const attempted = new Set<string>();

  function hardwareOf(device: ADBDevice): string | null {
    if (device.deviceKind === "emulator") return device.serial;
    if (device.connectionType === "usb") return device.serial;
    return serials.value[device.serial] ?? null;
  }

  async function lookUp(device: ADBDevice) {
    if (device.connectionType !== "wifi" || device.deviceKind === "emulator") return;
    if (device.isStale || device.status !== "online") return;
    if (device.serial in serials.value || attempted.has(device.serial)) return;
    attempted.add(device.serial);
    try {
      const hardware = (await shellCommand(device.serial, SERIAL_COMMAND)).trim();
      if (!hardware) return;
      serials.value = { ...serials.value, [device.serial]: hardware };
      writePersisted(LS_HARDWARE_SERIALS, serials.value);
    } catch (error) {
      console.warn(`Failed to read the hardware serial of ${device.serial}`, error);
    }
  }

  watch(
    () => sessionStore.devices,
    (devices) => {
      for (const device of devices) void lookUp(device);
    },
    { immediate: true },
  );

  return { serials, hardwareOf };
});
