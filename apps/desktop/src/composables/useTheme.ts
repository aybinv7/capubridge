import { computed } from "vue";
import { useThemeStore } from "@/stores/theme.store";
import { themes } from "@/themes/registry";

export function useTheme() {
  const store = useThemeStore();

  return {
    themeId: computed(() => store.themeId),
    mode: computed(() => store.mode),
    direction: computed(() => store.direction),
    availableThemes: themes,
    setTheme: store.setTheme,
  };
}
