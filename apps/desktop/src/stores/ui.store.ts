import { computed, ref } from "vue";
import { defineStore } from "pinia";

export type Theme = "system" | "dark" | "light";
export type ResolvedTheme = Exclude<Theme, "system">;

const themeStorageKey = "capubridge:theme";

function readSavedTheme(): Theme {
  const saved = localStorage.getItem(themeStorageKey);
  return saved === "system" || saved === "light" || saved === "dark" ? saved : "system";
}

export const useUIStore = defineStore("ui", () => {
  const activePanel = ref<string>("/devices");
  const sidebarCollapsed = ref(true);
  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  const systemPrefersDark = ref(colorScheme.matches);
  const theme = ref<Theme>(readSavedTheme());
  const resolvedTheme = computed<ResolvedTheme>(() =>
    theme.value === "system" ? (systemPrefersDark.value ? "dark" : "light") : theme.value,
  );

  function applyTheme() {
    const resolved = resolvedTheme.value;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  }

  applyTheme();

  colorScheme.addEventListener("change", (event) => {
    systemPrefersDark.value = event.matches;
    if (theme.value === "system") {
      applyTheme();
    }
  });

  function setTheme(t: Theme) {
    theme.value = t;
    applyTheme();
    localStorage.setItem(themeStorageKey, t);
  }

  function toggleTheme() {
    setTheme(resolvedTheme.value === "dark" ? "light" : "dark");
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
    resolvedTheme,
    setActivePanel,
    toggleSidebar,
    setTheme,
    toggleTheme,
  };
});
