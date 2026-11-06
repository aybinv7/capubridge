import { TIMELINE_LANES, type TimelineLane } from "@/types/timeline.types";
import { LANE_META } from "./laneMeta";
import type { Rect, RectList } from "./stripGeometry";

/** Resolved colours for the canvas, read from the theme's tokens. */
export interface StripPalette {
  lanes: Record<TimelineLane, string>;
  recording: string;
  hairline: string;
}

const FALLBACK = "#8c8c8c";

/** Reads the lane and overlay colours from the tokens in effect on `element`. */
export function readStripPalette(element: Element): StripPalette {
  const style = getComputedStyle(element);
  const read = (name: string) => style.getPropertyValue(name).trim() || FALLBACK;
  const lanes = {} as Record<TimelineLane, string>;
  for (const lane of TIMELINE_LANES) lanes[lane] = read(LANE_META[lane].colorVar);
  return { lanes, recording: read("--signal-rec"), hairline: read("--fg-subtle") };
}

/** Fills the first `count` rectangles of `rects` in one colour. */
export function paintRectList(
  ctx: CanvasRenderingContext2D,
  rects: RectList,
  color: string,
  alpha: number,
) {
  if (rects.count === 0) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const data = rects.data;
  for (let index = 0; index < rects.count; index += 1) {
    const offset = index * 4;
    ctx.fillRect(
      data[offset] ?? 0,
      data[offset + 1] ?? 0,
      data[offset + 2] ?? 0,
      data[offset + 3] ?? 0,
    );
  }
}

export function paintRects(
  ctx: CanvasRenderingContext2D,
  rects: readonly Rect[],
  color: string,
  alpha: number,
) {
  if (rects.length === 0) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (const rect of rects) ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
}
