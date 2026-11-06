import { h, type Component, type FunctionalComponent } from "vue";
import {
  PhAppWindow,
  PhCaretLeft,
  PhCaretRight,
  PhChartBar,
  PhCursorClick,
  PhDatabase,
  PhDeviceMobile,
  PhFlask,
  PhGear,
  PhGlobe,
  PhLightning,
  PhMagnifyingGlass,
  PhMonitorPlay,
  PhSquareHalf,
  PhSquareHalfBottom,
} from "@phosphor-icons/vue";
import type { ShellIconPair, ShellIconSet } from "./shell-icon.types";

function weighted(icon: Component, weight: "regular" | "fill", className?: string) {
  const glyph: FunctionalComponent = (_props, { attrs }) =>
    h(icon, { ...attrs, weight, class: [attrs.class, className] });
  return glyph;
}

function pair(icon: Component, className?: string): ShellIconPair {
  return {
    regular: weighted(icon, "regular", className),
    filled: weighted(icon, "fill", className),
  };
}

/** Phosphor (MIT): one drawing per glyph in six weights; the shell uses regular and fill. */
export const phosphorShellIcons: ShellIconSet = {
  name: "Phosphor",
  rail: {
    device: pair(PhDeviceMobile),
    app: pair(PhAppWindow),
    data: pair(PhDatabase),
    network: pair(PhGlobe),
    elements: pair(PhCursorClick),
    replay: pair(PhMonitorPlay),
    flows: pair(PhLightning),
    preview: pair(PhFlask),
    settings: pair(PhGear),
  },
  back: weighted(PhCaretLeft, "regular"),
  forward: weighted(PhCaretRight, "regular"),
  search: weighted(PhMagnifyingGlass, "regular"),
  panelRight: pair(PhSquareHalf),
  panelLeft: pair(PhSquareHalf, "-scale-x-100"),
  panelBottom: pair(PhSquareHalfBottom),
  timeline: pair(PhChartBar),
};
