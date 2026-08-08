import { useDevice } from "../../composables/useDevice.ts";

/**
 * Cladd's shared tooltip timer: the first hover waits the full delay, and once a tooltip has been
 * shown the delay collapses to 0 so successive hovers feel snappy — same UX as system tooltips.
 * A tooltip-free second restores the full delay.
 */
let tooltipGlobalTimeout = 0;
let tooltipGlobalTimeoutId = 0;

export function resetTooltipGlobalTimeout(): void {
  const device = useDevice();
  tooltipGlobalTimeout = device.mobile ? 500 : 1000;
}

export function getTooltipGlobalTimeout(): number {
  return tooltipGlobalTimeout;
}

export function clearTooltipGlobalTimeout(): void {
  window.clearTimeout(tooltipGlobalTimeoutId);
}

export function collapseTooltipGlobalTimeout(): void {
  tooltipGlobalTimeout = 0;
}

export function scheduleTooltipGlobalTimeoutReset(): void {
  tooltipGlobalTimeoutId = window.setTimeout(() => {
    resetTooltipGlobalTimeout();
  }, 1000);
}

resetTooltipGlobalTimeout();
