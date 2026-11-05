import { ref, watch } from "vue";
import { defineStore } from "pinia";
import type { ADBDevice } from "@/types/adb.types";
import { useAdb } from "@/composables/useAdb";
import {
  DEVICE_NAMING_COMMAND,
  friendlyDeviceName,
  parseDeviceNaming,
  type NamedDevice,
} from "@/lib/device-name";
import { readPersisted, writePersisted } from "@/lib/persisted";
import { useSessionStore } from "@/stores/session.store";

const LS_DEVICE_MAKERS = "capubridge:device-makers";
const LS_DEVICE_MARKET_NAMES = "capubridge:device-market-names";

function isNameMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

/**
 * Remembers what each model calls itself, so a device reads as "Redmi Note 14" everywhere, also in
 * history once it is unplugged; a device that names no market falls back to its maker and model.
 * Keyed by model rather than serial: the same handset shows up under a USB serial and under every
 * Wi-Fi address it ever had. A model is looked up at most once per session, with one shell call
 * the first time it is seen online; an empty market name is remembered too, so it is not asked
 * again.
 */
export const useDeviceNamesStore = defineStore("deviceNames", () => {
  const sessionStore = useSessionStore();
  const { shellCommand } = useAdb();
  const makers = ref<Record<string, string>>(
    readPersisted<Record<string, string>>(LS_DEVICE_MAKERS, {}, isNameMap),
  );
  const marketNames = ref<Record<string, string>>(
    readPersisted<Record<string, string>>(LS_DEVICE_MARKET_NAMES, {}, isNameMap),
  );
  const attempted = new Set<string>();

  function remember(model: string, manufacturer: string) {
    const maker = manufacturer.trim();
    if (!model || !maker || makers.value[model] === maker) return;
    makers.value = { ...makers.value, [model]: maker };
    writePersisted(LS_DEVICE_MAKERS, makers.value);
  }

  function rememberMarketName(model: string, marketName: string) {
    if (!model || marketNames.value[model] === marketName) return;
    marketNames.value = { ...marketNames.value, [model]: marketName };
    writePersisted(LS_DEVICE_MARKET_NAMES, marketNames.value);
  }

  function nameOf(device: NamedDevice): string {
    return friendlyDeviceName(device, makers.value[device.model], marketNames.value[device.model]);
  }

  async function lookUp(device: ADBDevice) {
    const model = device.model?.trim();
    if (!model || model in marketNames.value || attempted.has(model)) return;
    if (device.isStale || device.status !== "online" || device.deviceKind === "emulator") return;
    attempted.add(model);
    try {
      const naming = parseDeviceNaming(await shellCommand(device.serial, DEVICE_NAMING_COMMAND));
      remember(model, naming.manufacturer);
      rememberMarketName(model, naming.marketName);
    } catch (error) {
      console.warn(`Failed to read the name of ${device.serial}`, error);
    }
  }

  watch(
    () => sessionStore.devices,
    (devices) => {
      for (const device of devices) void lookUp(device);
    },
    { immediate: true },
  );

  return { makers, marketNames, nameOf, remember };
});
