import { ref } from "vue";
import { defineStore } from "pinia";

const LS_RAIL_COLLAPSED = "capubridge:rail-collapsed";

/** Sections of the device manager a caller can open it on. */
export type DeviceManagerPanel = "device" | "local" | "connect" | "emulators";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(LS_RAIL_COLLAPSED) === "true";
  } catch {
    return false;
  }
}

export const useUIStore = defineStore("ui", () => {
  const activePanel = ref<string>("/devices");
  const sidebarCollapsed = ref(readCollapsed());
  const deviceManagerOpen = ref(false);
  const deviceManagerPanel = ref<DeviceManagerPanel | null>(null);

  function setActivePanel(path: string) {
    activePanel.value = path;
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    try {
      localStorage.setItem(LS_RAIL_COLLAPSED, String(sidebarCollapsed.value));
    } catch (error) {
      console.warn("Failed to persist rail state", error);
    }
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
    sidebarCollapsed,
    deviceManagerOpen,
    deviceManagerPanel,
    setActivePanel,
    toggleSidebar,
    openDeviceManager,
    closeDeviceManager,
  };
});
