import { onMounted, shallowRef, watch } from "vue";
import { useThemeStore } from "@/stores/theme.store";
import { TIMELINE_LANES } from "@/types/timeline.types";
import { readStripPalette, type StripPalette } from "./stripPaint";

function placeholder(): StripPalette {
  const lanes = {} as StripPalette["lanes"];
  for (const lane of TIMELINE_LANES) lanes[lane] = "transparent";
  return { lanes, recording: "transparent", hairline: "transparent" };
}

/** The canvas colours of the current theme, read again whenever the theme changes. */
export function useStripPalette() {
  const theme = useThemeStore();
  const palette = shallowRef<StripPalette>(placeholder());

  function read() {
    palette.value = readStripPalette(document.documentElement);
  }

  onMounted(read);
  watch(() => theme.themeId, read, { flush: "post" });

  return palette;
}
