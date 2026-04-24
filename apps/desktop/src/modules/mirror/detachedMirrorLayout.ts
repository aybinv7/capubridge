export type DetachedMirrorLayoutMode = "large" | "panel";

interface DetachedMirrorLayoutMetricsInput {
  preferredWidth: number;
  aspectRatio: number;
  availWidth: number;
  availHeight: number;
  mode: DetachedMirrorLayoutMode;
  settingsOpen: boolean;
  isRecording: boolean;
}

interface DetachedMirrorLayoutMetrics {
  phoneWidth: number;
  phoneHeight: number;
  windowWidth: number;
  windowHeight: number;
}

const SCREEN_MARGIN_TOTAL = 56;
const PHONE_MIN_WIDTH = 220;
const LARGE_HEADER_HEIGHT = 40;
const PANEL_HEADER_HEIGHT = 36;
const LARGE_SETTINGS_HEIGHT = 168;
const LARGE_VERTICAL_PADDING = 24;
const PANEL_VERTICAL_PADDING = 12;
const LARGE_RECORDING_HEIGHT = 18;
const LARGE_WINDOW_HORIZONTAL = 24;
const PANEL_WINDOW_HORIZONTAL = 12;
const PANEL_RAIL_WIDTH = 52;
const LARGE_WINDOW_MIN_WIDTH = 264;
const PANEL_WINDOW_MIN_WIDTH = 212;
const WINDOW_MIN_HEIGHT = 420;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getLayoutChromeHeight(
  mode: DetachedMirrorLayoutMode,
  settingsOpen: boolean,
  isRecording: boolean,
) {
  if (mode === "large") {
    return (
      LARGE_HEADER_HEIGHT +
      (settingsOpen ? LARGE_SETTINGS_HEIGHT : 0) +
      LARGE_VERTICAL_PADDING +
      (isRecording ? LARGE_RECORDING_HEIGHT : 0)
    );
  }

  return PANEL_HEADER_HEIGHT + PANEL_VERTICAL_PADDING;
}

function getWindowHorizontal(mode: DetachedMirrorLayoutMode) {
  return mode === "large" ? LARGE_WINDOW_HORIZONTAL : PANEL_WINDOW_HORIZONTAL;
}

function getSideRailWidth(mode: DetachedMirrorLayoutMode) {
  return mode === "panel" ? PANEL_RAIL_WIDTH : 0;
}

function getWindowMinWidth(mode: DetachedMirrorLayoutMode) {
  return mode === "large" ? LARGE_WINDOW_MIN_WIDTH : PANEL_WINDOW_MIN_WIDTH;
}

export function getDetachedMirrorLayoutMetrics(
  input: DetachedMirrorLayoutMetricsInput,
): DetachedMirrorLayoutMetrics {
  const aspectRatio = input.aspectRatio > 0 ? input.aspectRatio : 9 / 19.5;
  const chromeHeight = getLayoutChromeHeight(input.mode, input.settingsOpen, input.isRecording);
  const windowHorizontal = getWindowHorizontal(input.mode);
  const sideRailWidth = getSideRailWidth(input.mode);
  const maxPhoneHeight = Math.max(1, input.availHeight - SCREEN_MARGIN_TOTAL - chromeHeight);
  const heightBoundPhoneWidth = Math.max(1, Math.round(maxPhoneHeight * aspectRatio));
  const maxPhoneWidth = Math.max(
    1,
    input.availWidth - SCREEN_MARGIN_TOTAL - windowHorizontal - sideRailWidth,
  );
  const phoneMinWidth = Math.min(PHONE_MIN_WIDTH, heightBoundPhoneWidth, maxPhoneWidth);
  const preferredWidth = Math.max(
    input.preferredWidth,
    Math.min(heightBoundPhoneWidth, maxPhoneWidth),
  );
  const phoneWidth = clamp(
    Math.min(preferredWidth, heightBoundPhoneWidth, maxPhoneWidth),
    phoneMinWidth,
    maxPhoneWidth,
  );
  const phoneHeight = Math.round(phoneWidth / aspectRatio);
  const windowWidth = clamp(
    Math.max(getWindowMinWidth(input.mode), phoneWidth + windowHorizontal + sideRailWidth),
    getWindowMinWidth(input.mode),
    input.availWidth - 24,
  );
  const windowHeight = clamp(phoneHeight + chromeHeight, WINDOW_MIN_HEIGHT, input.availHeight - 24);

  return {
    phoneWidth,
    phoneHeight,
    windowWidth,
    windowHeight,
  };
}
