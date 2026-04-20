import { ref } from "vue";
import { defineStore } from "pinia";

export type Theme = "dark" | "light";

export const useUIStore = defineStore("ui", () => {
  const activePanel = ref<string>("/devices");
  const sidebarCollapsed = ref(false);

  const saved = localStorage.getItem("capubridge:theme") as Theme | null;
  const theme = ref<Theme>(saved ?? "dark");

  function applyTheme(t: Theme) {
    document.documentElement.classList.toggle("dark", t === "dark");
  }

  applyTheme(theme.value);

  function setTheme(t: Theme) {
    theme.value = t;
    applyTheme(t);
    localStorage.setItem("capubridge:theme", t);
  }

  function toggleTheme() {
    setTheme(theme.value === "dark" ? "light" : "dark");
  }

  function setActivePanel(path: string) {
    activePanel.value = path;
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  return {
    activePanel,
    sidebarCollapsed,
    theme,
    setActivePanel,
    toggleSidebar,
    setTheme,
    toggleTheme,
  };
});
