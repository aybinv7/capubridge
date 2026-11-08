import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { getAvailableTheme, getTheme, applyTheme, DEFAULT_THEME_ID } from "../themes/registry";

const LS_THEME = "capubridge:theme-id";

export const useThemeStore = defineStore("theme", () => {
  const themeId = ref<string>(DEFAULT_THEME_ID);

  const theme = computed(() => getTheme(themeId.value));
  const mode = computed(() => theme.value.mode);
  const direction = computed(() => theme.value.direction);

  function reapply() {
    applyTheme(theme.value);
  }

  function initialize() {
    const saved = localStorage.getItem(LS_THEME);
    themeId.value = getAvailableTheme(saved ?? DEFAULT_THEME_ID).id;
    reapply();
  }

  function setTheme(id: string) {
    themeId.value = getAvailableTheme(id).id;
    localStorage.setItem(LS_THEME, themeId.value);
    reapply();
  }

  return {
    themeId,
    theme,
    mode,
    direction,
    initialize,
    setTheme,
  };
});
