import type { Component } from "vue";
import { ArrowLeftRight, CircleAlert, ScrollText, SquareTerminal } from "lucide-vue-next";
import type { TimelineLane } from "@/types/timeline.types";

/** How a lane is named and drawn. Only Errors is red; the others use quiet category tones. */
export interface LaneMeta {
  label: string;
  icon: Component;
  /** The CSS custom property the canvas paints the lane with. */
  colorVar: string;
  /** Text tone for the lane's icon in lists and cards. */
  iconClass: string;
  /** Fill for the lane's small dot beside its label. */
  dotClass: string;
}

export const LANE_META: Readonly<Record<TimelineLane, LaneMeta>> = {
  errors: {
    label: "Errors",
    icon: CircleAlert,
    colorVar: "--error",
    iconClass: "text-error",
    dotClass: "bg-error",
  },
  network: {
    label: "Network",
    icon: ArrowLeftRight,
    colorVar: "--cat-network",
    iconClass: "text-cat-network",
    dotClass: "bg-cat-network",
  },
  console: {
    label: "Console",
    icon: SquareTerminal,
    colorVar: "--cat-console",
    iconClass: "text-cat-console",
    dotClass: "bg-cat-console",
  },
  logcat: {
    label: "Logcat",
    icon: ScrollText,
    colorVar: "--cat-device",
    iconClass: "text-cat-device",
    dotClass: "bg-cat-device",
  },
};

/** Paint strength per lane state: quiet at rest, clearer expanded, faint when muted. */
export const LANE_ALPHA = {
  rest: 0.5,
  expanded: 0.72,
  error: 1,
  muted: 0.14,
} as const;

export function laneAlpha(lane: TimelineLane, muted: boolean, expanded: boolean): number {
  if (muted) return LANE_ALPHA.muted;
  if (lane === "errors") return LANE_ALPHA.error;
  return expanded ? LANE_ALPHA.expanded : LANE_ALPHA.rest;
}
