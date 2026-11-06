import { TIMELINE_LANES, type TimelineLane, type TimelineOverlay } from "@/types/timeline.types";
import { laneAlpha } from "./laneMeta";
import {
  AXIS_TOP,
  REST_HEIGHT,
  hairlineRects,
  rangeRects,
  type LaneRects,
  type StripScale,
} from "./stripGeometry";
import { paintRectList, paintRects, type StripPalette } from "./stripPaint";

export interface PaintInput {
  rects: LaneRects;
  scale: StripScale;
  palette: StripPalette;
  muted: ReadonlySet<TimelineLane>;
  overlays: readonly TimelineOverlay[];
  now: number;
}

const HAIRLINE_ALPHA = 0.35;
const RANGE_ALPHA = 0.8;
const ERRORS_LAST: readonly TimelineLane[] = ["logcat", "console", "network", "errors"];

function paintOverlays(
  ctx: CanvasRenderingContext2D,
  input: PaintInput,
  top: number,
  bottom: number,
  rangeY: number,
) {
  const hairlines: number[] = [];
  const ranges: TimelineOverlay[] = [];
  for (const overlay of input.overlays) {
    if (overlay.kind === "recording") ranges.push(overlay);
    else hairlines.push(overlay.start);
  }
  paintRects(
    ctx,
    hairlineRects(hairlines, input.scale, top, bottom),
    input.palette.hairline,
    HAIRLINE_ALPHA,
  );
  paintRects(
    ctx,
    rangeRects(ranges, input.scale, rangeY, input.now),
    input.palette.recording,
    RANGE_ALPHA,
  );
}

/** The resting strip: stacked quiet density, red caps for errors, then overlays. */
export function paintDensity(ctx: CanvasRenderingContext2D, input: PaintInput) {
  paintOverlays(ctx, input, 4, REST_HEIGHT - 4, REST_HEIGHT - 3);
  for (const lane of ERRORS_LAST) {
    paintRectList(
      ctx,
      input.rects[lane],
      input.palette.lanes[lane],
      laneAlpha(lane, input.muted.has(lane), false),
    );
  }
}

/** The expanded strip: one row per lane, then overlays across the rows. */
export function paintLanes(ctx: CanvasRenderingContext2D, input: PaintInput) {
  paintOverlays(ctx, input, 2, AXIS_TOP, AXIS_TOP - 1.5);
  for (const lane of TIMELINE_LANES) {
    paintRectList(
      ctx,
      input.rects[lane],
      input.palette.lanes[lane],
      laneAlpha(lane, input.muted.has(lane), true),
    );
  }
}
