import { computed } from "vue";
import { useThemeStore } from "@/stores/theme.store";
import { themes } from "@/themes/registry";
import { presetAccents } from "@/themes/accent-ramps";

/**
 * Component-friendly wrapper around themeStore. Exposes the active theme/
 * accent ids, the available themes/accents, and bound setters.
 *
 * Components should prefer this composable over importing the store directly
 * to avoid coupling to Pinia internals from the template.
 */
export function useTheme() {
  const store = useThemeStore();

  return {
    themeId: computed(() => store.themeId),
    accentId: computed(() => store.accentId),
    customAccentHex: computed(() => store.customAccentHex),
    mode: computed(() => store.mode),
    availableThemes: themes,
    availableAccents: presetAccents,
    setTheme: store.setTheme,
    setAccent: store.setAccent,
    setCustomAccent: store.setCustomAccent,
  };
}
