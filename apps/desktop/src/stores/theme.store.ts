import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { getTheme, applyTheme, DEFAULT_THEME_ID, DEFAULT_ACCENT_ID } from "../themes/registry";
import { getAccentRamp, hexToRamp } from "../themes/accent-ramps";

const LS_THEME = "capubridge:theme-id";
const LS_ACCENT = "capubridge:accent-id";
const LS_ACCENT_HEX = "capubridge:accent-hex";

export const useThemeStore = defineStore("theme", () => {
  const themeId = ref<string>(DEFAULT_THEME_ID);
  const accentId = ref<string>(DEFAULT_ACCENT_ID);
  const customAccentHex = ref<string | null>(null);

  const mode = computed(() => getTheme(themeId.value).mode);

  function currentAccent() {
    if (accentId.value === "custom" && customAccentHex.value) {
      return hexToRamp(customAccentHex.value);
    }
    try {
      return getAccentRamp(accentId.value);
    } catch {
      return getAccentRamp(DEFAULT_ACCENT_ID);
    }
  }

  function reapply() {
    applyTheme(getTheme(themeId.value), currentAccent());
  }

  function initialize() {
    const savedTheme = localStorage.getItem(LS_THEME);
    const savedAccent = localStorage.getItem(LS_ACCENT);
    const savedHex = localStorage.getItem(LS_ACCENT_HEX);

    if (savedTheme) themeId.value = savedTheme;
    if (savedAccent) accentId.value = savedAccent;
    if (savedHex) customAccentHex.value = savedHex;

    reapply();
  }

  function setTheme(id: string) {
    themeId.value = id;
    localStorage.setItem(LS_THEME, id);
    reapply();
  }

  function setAccent(id: string) {
    accentId.value = id;
    localStorage.setItem(LS_ACCENT, id);
    reapply();
  }

  function setCustomAccent(hex: string) {
    accentId.value = "custom";
    customAccentHex.value = hex;
    localStorage.setItem(LS_ACCENT, "custom");
    localStorage.setItem(LS_ACCENT_HEX, hex);
    reapply();
  }

  return {
    themeId,
    accentId,
    customAccentHex,
    mode,
    initialize,
    setTheme,
    setAccent,
    setCustomAccent,
  };
});
