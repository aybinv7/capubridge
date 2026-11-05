export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** `x`/`y` move the image centre away from the viewport centre, in screen pixels. */
export interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

export const MIN_SCALE = 0.02;
export const MAX_SCALE = 32;
export const ZOOM_STEPS = [
  0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32,
] as const;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** The scale that fits the image inside the viewport, never enlarging a small image. */
export function fitScale(image: Size, viewport: Size, padding = 24): number {
  if (image.width <= 0 || image.height <= 0) return 1;
  const width = Math.max(1, viewport.width - padding * 2);
  const height = Math.max(1, viewport.height - padding * 2);
  return clampScale(Math.min(1, width / image.width, height / image.height));
}

function clampAxis(offset: number, imageLength: number, viewportLength: number): number {
  const room = Math.max(0, (imageLength - viewportLength) / 2);
  return Math.min(room, Math.max(-room, offset));
}

/** Keeps the image centred on an axis where it fits, and its edges inside where it does not. */
export function clampOffset(state: ZoomState, image: Size, viewport: Size): ZoomState {
  return {
    scale: state.scale,
    x: clampAxis(state.x, image.width * state.scale, viewport.width),
    y: clampAxis(state.y, image.height * state.scale, viewport.height),
  };
}

/**
 * Zooms by `factor` keeping the image point under `point` still. `point` is relative to the
 * viewport centre, the same frame as the offset.
 */
export function zoomAt(
  state: ZoomState,
  factor: number,
  point: Point,
  image: Size,
  viewport: Size,
): ZoomState {
  const scale = clampScale(state.scale * factor);
  const ratio = scale / state.scale;
  return clampOffset(
    {
      scale,
      x: point.x - (point.x - state.x) * ratio,
      y: point.y - (point.y - state.y) * ratio,
    },
    image,
    viewport,
  );
}

/** A smooth zoom factor from a wheel event; pinch gestures arrive as ctrl+wheel and move faster. */
export function wheelFactor(deltaY: number, deltaMode: number, pinch: boolean): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  const speed = pinch ? 0.01 : 0.0015;
  return Math.exp(-Math.max(-300, Math.min(300, pixels)) * speed);
}

/** The next preset scale up or down from `scale`, for the zoom buttons. */
export function zoomStep(scale: number, direction: 1 | -1): number {
  const epsilon = 0.0001;
  if (direction === 1) {
    return ZOOM_STEPS.find((step) => step > scale + epsilon) ?? MAX_SCALE;
  }
  for (let index = ZOOM_STEPS.length - 1; index >= 0; index -= 1) {
    const step = ZOOM_STEPS[index];
    if (step !== undefined && step < scale - epsilon) return step;
  }
  return MIN_SCALE;
}

/** "100%", "33%", "2400%". */
export function zoomLabel(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}
