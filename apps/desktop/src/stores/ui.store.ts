import { ref } from "vue";
import { defineStore } from "pinia";
import { readPersisted, writePersisted } from "@/lib/persisted";

const LS_RAIL_HIDDEN = "capubridge:rail-hidden";

/** Sections of the device manager a caller can open it on. */
export type DeviceManagerPanel = "device" | "local" | "connect" | "emulators";

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export const useUIStore = defineStore("ui", () => {
  const activePanel = ref<string>("/devices");
  const railHidden = ref(readPersisted<boolean>(LS_RAIL_HIDDEN, false, isBoolean));
  const deviceManagerOpen = ref(false);
  const deviceManagerPanel = ref<DeviceManagerPanel | null>(null);

  function setActivePanel(path: string) {
    activePanel.value = path;
  }

  function toggleRail() {
    railHidden.value = !railHidden.value;
    writePersisted(LS_RAIL_HIDDEN, railHidden.value);
  }

  function openDeviceManager(panel: DeviceManagerPanel | null = null) {
    deviceManagerPanel.value = panel;
    deviceManagerOpen.value = true;
  }

  function closeDeviceManager() {
    deviceManagerOpen.value = false;
    deviceManagerPanel.value = null;
  }

  return {
    activePanel,
    railHidden,
    deviceManagerOpen,
    deviceManagerPanel,
    setActivePanel,
    toggleRail,
    openDeviceManager,
    closeDeviceManager,
  };
});
