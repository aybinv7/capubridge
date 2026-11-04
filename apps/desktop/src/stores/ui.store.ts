import { ref } from "vue";
import { defineStore } from "pinia";

const LS_RAIL_COLLAPSED = "capubridge:rail-collapsed";

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

  return {
    activePanel,
    sidebarCollapsed,
    setActivePanel,
    toggleSidebar,
  };
});
