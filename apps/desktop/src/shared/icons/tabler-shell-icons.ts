import { h, type Component, type FunctionalComponent } from "vue";
import {
  IconAppWindow,
  IconAppWindowFilled,
  IconBolt,
  IconBoltFilled,
  IconBug,
  IconBugFilled,
  IconChevronLeft,
  IconChevronRight,
  IconDatabase,
  IconDatabaseFilled,
  IconDeviceMobile,
  IconDeviceMobileFilled,
  IconFlask,
  IconFlaskFilled,
  IconLayoutBottombar,
  IconLayoutBottombarFilled,
  IconLayoutSidebar,
  IconLayoutSidebarFilled,
  IconLayoutSidebarRight,
  IconLayoutSidebarRightFilled,
  IconPlayerPlay,
  IconPlayerPlayFilled,
  IconPointer,
  IconPointerFilled,
  IconSearch,
  IconSettings,
  IconSettingsFilled,
  IconTimelineEvent,
  IconTimelineEventFilled,
  IconWorld,
  IconWorldFilled,
} from "@tabler/icons-vue";
import type { ShellIconPair, ShellIconSet } from "./shell-icon.types";

/** Tabler draws on a 24 grid at stroke 2; 1.75 matches the shell's text weight at 14 to 20 px. */
function outline(icon: Component) {
  const glyph: FunctionalComponent = (_props, { attrs }) => h(icon, { ...attrs, stroke: 1.75 });
  return glyph;
}

function pair(regular: Component, filled: Component): ShellIconPair {
  return { regular: outline(regular), filled };
}

/** Tabler (MIT): outline icons with a hand-drawn filled companion for a subset. */
export const tablerShellIcons: ShellIconSet = {
  name: "Tabler",
  rail: {
    device: pair(IconDeviceMobile, IconDeviceMobileFilled),
    app: pair(IconAppWindow, IconAppWindowFilled),
    data: pair(IconDatabase, IconDatabaseFilled),
    network: pair(IconWorld, IconWorldFilled),
    elements: pair(IconPointer, IconPointerFilled),
    devtools: pair(IconBug, IconBugFilled),
    replay: pair(IconPlayerPlay, IconPlayerPlayFilled),
    flows: pair(IconBolt, IconBoltFilled),
    preview: pair(IconFlask, IconFlaskFilled),
    settings: pair(IconSettings, IconSettingsFilled),
  },
  back: outline(IconChevronLeft),
  forward: outline(IconChevronRight),
  search: outline(IconSearch),
  panelRight: pair(IconLayoutSidebarRight, IconLayoutSidebarRightFilled),
  panelLeft: pair(IconLayoutSidebar, IconLayoutSidebarFilled),
  panelBottom: pair(IconLayoutBottombar, IconLayoutBottombarFilled),
  timeline: pair(IconTimelineEvent, IconTimelineEventFilled),
};
