import { resolveTooltipOffset } from './overlay.contracts.ts';

/** Gap between a rail item and its side tooltip. */
export const navRailTooltipOffset = 8;

export const navRailTooltipOriginClasses = 'origin-left';

export const navRailTooltipContentClasses = 'flex items-center gap-2';

/**
 * Anchors the tooltip to the right of its item, vertically centred, and flips it to the left when
 * the rail sits against the right edge of the viewport.
 */
export function buildNavRailTooltipStyle(
  anchorName: string,
  offset: number = navRailTooltipOffset,
): Record<string, string> {
  return {
    marginLeft: resolveTooltipOffset(offset),
    positionAnchor: anchorName,
    positionArea: 'center right',
    positionTryFallbacks: 'flip-inline',
  };
}
