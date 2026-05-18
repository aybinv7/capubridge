import { ref } from "vue";
import { defineStore } from "pinia";

export const useUIStore = defineStore("ui", () => {
  const activePanel = ref<string>("/devices");
  const sidebarCollapsed = ref(true);

  function setActivePanel(path: string) {
    activePanel.value = path;
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  return {
    activePanel,
    sidebarCollapsed,
    setActivePanel,
    toggleSidebar,
  };
});
