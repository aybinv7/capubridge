import { ref, watch } from "vue";
import { defineStore } from "pinia";
import type { ADBDevice } from "@/types/adb.types";
import { useAdb } from "@/composables/useAdb";
import { friendlyDeviceName, type NamedDevice } from "@/lib/device-name";
import { readPersisted, writePersisted } from "@/lib/persisted";
import { useSessionStore } from "@/stores/session.store";

const LS_DEVICE_MAKERS = "capubridge:device-makers";
const MANUFACTURER_COMMAND = "getprop ro.product.manufacturer";

function isMakerMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

/**
 * Remembers each model's manufacturer, so a device reads as "Xiaomi 24117RN76G" everywhere, also
 * in history once it is unplugged. Keyed by model rather than serial: the same handset shows up
 * under a USB serial and under every Wi-Fi address it ever had. A model is looked up at most once
 * per session, with one `getprop` the first time it is seen online; a failed lookup is not retried
 * until the device manager loads that device's details, which also feed `remember`.
 */
export const useDeviceNamesStore = defineStore("deviceNames", () => {
  const sessionStore = useSessionStore();
  const { shellCommand } = useAdb();
  const makers = ref<Record<string, string>>(
    readPersisted<Record<string, string>>(LS_DEVICE_MAKERS, {}, isMakerMap),
  );
  const attempted = new Set<string>();

  function remember(model: string, manufacturer: string) {
    const maker = manufacturer.trim();
    if (!model || !maker || makers.value[model] === maker) return;
    makers.value = { ...makers.value, [model]: maker };
    writePersisted(LS_DEVICE_MAKERS, makers.value);
  }

  function nameOf(device: NamedDevice): string {
    return friendlyDeviceName(device, makers.value[device.model]);
  }

  async function lookUp(device: ADBDevice) {
    const model = device.model?.trim();
    if (!model || model in makers.value || attempted.has(model)) return;
    if (device.isStale || device.status !== "online" || device.deviceKind === "emulator") return;
    attempted.add(model);
    try {
      remember(model, await shellCommand(device.serial, MANUFACTURER_COMMAND));
    } catch (error) {
      console.warn(`Failed to read the manufacturer of ${device.serial}`, error);
    }
  }

  watch(
    () => sessionStore.devices,
    (devices) => {
      for (const device of devices) void lookUp(device);
    },
    { immediate: true },
  );

  return { makers, nameOf, remember };
});
