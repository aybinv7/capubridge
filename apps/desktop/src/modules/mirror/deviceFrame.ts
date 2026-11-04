import type { DeviceOrientation } from "./deviceRotation";

/** Width of the drawn bezel around the screen. */
export const BEZEL_PX = 4;

/** Portrait phone aspect used before the first frame reports the real size. */
export const FALLBACK_ASPECT = 9 / 19.5;

/** Modern phones round their display corners at roughly this share of the short side. */
const CORNER_SHARE = 0.085;
const MIN_CORNER_PX = 6;
const MAX_CORNER_PX = 44;

/** Horizontal space the column spends around the well: margins, padding and the panel border. */
export const COLUMN_CHROME_X_PX = 34;
/** Vertical padding inside the well. */
export const WELL_PADDING_Y_PX = 16;
export const PANEL_MIN_WIDTH_PX = 220;
export const PANEL_MAX_WIDTH_PX = 560;

export interface DeviceFrame {
  /** Outer size of the bezel. */
  width: number;
  height: number;
  /** Size of the screen inside the bezel; it has the stream's exact aspect. */
  screenWidth: number;
  screenHeight: number;
  bezel: number;
  outerRadius: number;
  innerRadius: number;
  orientation: DeviceOrientation;
}

export function streamAspect(deviceWidth: number, deviceHeight: number): number {
  return deviceWidth > 0 && deviceHeight > 0 ? deviceWidth / deviceHeight : FALLBACK_ASPECT;
}

/**
 * Fits a device to the well like `object-fit: contain`, so the bezel hugs the stream with no black
 * bands, whichever way the device is turned, and rounds the corners like the real display.
 */
export function fitDeviceFrame(input: {
  areaWidth: number;
  areaHeight: number;
  deviceWidth: number;
  deviceHeight: number;
}): DeviceFrame {
  const aspect = streamAspect(input.deviceWidth, input.deviceHeight);
  const availableWidth = Math.max(0, input.areaWidth - 2 * BEZEL_PX);
  const availableHeight = Math.max(0, input.areaHeight - 2 * BEZEL_PX);
  const screenWidth = Math.floor(Math.min(availableWidth, availableHeight * aspect));
  const screenHeight = Math.floor(screenWidth / aspect);
  const shortSide = Math.min(screenWidth, screenHeight);
  const innerRadius =
    shortSide > 0
      ? Math.round(Math.min(MAX_CORNER_PX, Math.max(MIN_CORNER_PX, shortSide * CORNER_SHARE)))
      : 0;
  return {
    width: screenWidth > 0 ? screenWidth + 2 * BEZEL_PX : 0,
    height: screenHeight > 0 ? screenHeight + 2 * BEZEL_PX : 0,
    screenWidth,
    screenHeight,
    bezel: BEZEL_PX,
    outerRadius: innerRadius + BEZEL_PX,
    innerRadius,
    orientation: aspect > 1 ? "landscape" : "portrait",
  };
}

/** The column width that lets a device of this aspect fill a well of this height. */
export function idealColumnWidth(wellHeight: number, aspect: number): number {
  const screenHeight = Math.max(0, wellHeight - WELL_PADDING_Y_PX - 2 * BEZEL_PX);
  const width = Math.round(screenHeight * aspect + 2 * BEZEL_PX + COLUMN_CHROME_X_PX);
  return Math.min(PANEL_MAX_WIDTH_PX, Math.max(PANEL_MIN_WIDTH_PX, width));
}
