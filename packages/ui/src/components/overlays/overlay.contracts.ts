export const popoverPositions = [
  "top-start",
  "top",
  "top-end",
  "bottom-start",
  "bottom",
  "bottom-end",
  "left-start",
  "left",
  "left-end",
  "right-start",
  "right",
  "right-end",
  "center",
] as const;

export type PopoverPosition = (typeof popoverPositions)[number];

export const tooltipPositions = ["top", "bottom"] as const;

export type TooltipPosition = (typeof tooltipPositions)[number];

export type OverlayOffsetValue = number | string;

export type PopoverOffset = OverlayOffsetValue | [OverlayOffsetValue, OverlayOffsetValue];

export type OverlayMarginProperty = "marginBottom" | "marginLeft" | "marginRight" | "marginTop";

export interface PopoverPositionConfig {
  alignSelf?: string;
  area: string;
  centered?: boolean;
  justifySelf?: string;
  offsetProperties: [OverlayMarginProperty, OverlayMarginProperty];
  transformOrigin: string;
}

export const popoverPositionConfigs: Record<PopoverPosition, PopoverPositionConfig> = {
  "top-start": {
    area: "top center",
    justifySelf: "start",
    transformOrigin: "bottom left",
    offsetProperties: ["marginBottom", "marginLeft"],
  },
  top: {
    area: "top center",
    transformOrigin: "bottom",
    offsetProperties: ["marginBottom", "marginLeft"],
  },
  "top-end": {
    area: "top center",
    justifySelf: "end",
    transformOrigin: "bottom right",
    offsetProperties: ["marginBottom", "marginRight"],
  },
  "bottom-start": {
    area: "bottom center",
    justifySelf: "start",
    transformOrigin: "top left",
    offsetProperties: ["marginTop", "marginLeft"],
  },
  bottom: {
    area: "bottom center",
    transformOrigin: "top",
    offsetProperties: ["marginTop", "marginLeft"],
  },
  "bottom-end": {
    area: "bottom center",
    justifySelf: "end",
    transformOrigin: "top right",
    offsetProperties: ["marginTop", "marginRight"],
  },
  "left-start": {
    area: "center left",
    alignSelf: "start",
    transformOrigin: "top right",
    offsetProperties: ["marginRight", "marginTop"],
  },
  left: {
    area: "center left",
    transformOrigin: "right",
    offsetProperties: ["marginRight", "marginTop"],
  },
  "left-end": {
    area: "center left",
    alignSelf: "end",
    transformOrigin: "bottom right",
    offsetProperties: ["marginRight", "marginBottom"],
  },
  "right-start": {
    area: "center right",
    alignSelf: "start",
    transformOrigin: "top left",
    offsetProperties: ["marginLeft", "marginTop"],
  },
  right: {
    area: "center right",
    transformOrigin: "left",
    offsetProperties: ["marginLeft", "marginTop"],
  },
  "right-end": {
    area: "center right",
    alignSelf: "end",
    transformOrigin: "bottom left",
    offsetProperties: ["marginLeft", "marginBottom"],
  },
  center: {
    area: "center center",
    transformOrigin: "center",
    offsetProperties: ["marginTop", "marginLeft"],
    centered: true,
  },
};

export const overlayOppositeMargins: Record<OverlayMarginProperty, OverlayMarginProperty> = {
  marginTop: "marginBottom",
  marginBottom: "marginTop",
  marginLeft: "marginRight",
  marginRight: "marginLeft",
};

export const popoverPositionTryFallbacks = "flip-block, flip-inline, flip-block flip-inline";

export const tooltipPositionTryFallbacks = "flip-block";

export const popoverFallbackPosition: PopoverPosition = "right-start";

export const popoverChildOverlaySelector = ".cui-popover, .cui-dialog";

export const dialogChildOverlaySelector = ".cui-popover, .cui-dialog, .cui-popup";

export const popoverContainerSelector = ".cui-popover";

export function resolvePopoverOffset(
  value: OverlayOffsetValue,
  marginProperty: OverlayMarginProperty,
): string {
  if (typeof value === "number") return `${value}px`;
  if (value.endsWith("%")) {
    const fraction = Number.parseFloat(value) / 100;
    const dimension =
      marginProperty === "marginTop" || marginProperty === "marginBottom" ? "height" : "width";
    return `calc(anchor-size(${dimension}) * ${fraction})`;
  }
  return value;
}

export function resolveTooltipOffset(value: OverlayOffsetValue): string {
  if (typeof value === "number") return `${value}px`;
  if (value.endsWith("%")) {
    const fraction = Number.parseFloat(value) / 100;
    return `calc(anchor-size(height) * ${fraction})`;
  }
  return value;
}

export function buildPopoverPositionStyle(options: {
  anchorName: string;
  offset?: PopoverOffset;
  position: PopoverPosition;
  viewportMargin: number;
}): Record<string, string> {
  const config =
    popoverPositionConfigs[options.position] ?? popoverPositionConfigs[popoverFallbackPosition];
  const [mainOffset, crossOffset] = Array.isArray(options.offset)
    ? options.offset
    : [options.offset ?? 0, 0];
  const [mainProperty, crossProperty] = config.offsetProperties;
  const centered = !config.justifySelf && !config.alignSelf;
  const viewportMargin = options.viewportMargin > 0 ? `${options.viewportMargin}px` : undefined;
  const style: Record<string, string> = {
    positionAnchor: options.anchorName,
    positionArea: config.area,
    positionTryFallbacks: popoverPositionTryFallbacks,
    transformOrigin: config.transformOrigin,
  };

  if (config.justifySelf) style.justifySelf = config.justifySelf;
  if (config.alignSelf) style.alignSelf = config.alignSelf;

  if (viewportMargin) {
    style[overlayOppositeMargins[mainProperty]] = viewportMargin;
    style[overlayOppositeMargins[crossProperty]] = viewportMargin;
    if (centered) style[crossProperty] = viewportMargin;
    if (config.centered) style[mainProperty] = viewportMargin;
  }

  if (mainOffset) style[mainProperty] = resolvePopoverOffset(mainOffset, mainProperty);
  if (crossOffset) style[crossProperty] = resolvePopoverOffset(crossOffset, crossProperty);

  return style;
}

export function buildTooltipPositionStyle(options: {
  anchorName: string;
  offset?: OverlayOffsetValue;
  position: TooltipPosition;
}): Record<string, string> {
  const isTop = options.position === "top";
  const style: Record<string, string> = {
    positionAnchor: options.anchorName,
    positionArea: isTop ? "top center" : "bottom center",
    positionTryFallbacks: tooltipPositionTryFallbacks,
    transformOrigin: isTop ? "bottom" : "top",
  };

  if (options.offset) {
    style[isTop ? "marginBottom" : "marginTop"] = resolveTooltipOffset(options.offset);
  }

  return style;
}

export function buildAnchorRectStyle(
  rect: DOMRectReadOnly,
  anchorName: string,
): Record<string, string> {
  return {
    anchorName,
    height: `${rect.height}px`,
    left: `${rect.left}px`,
    pointerEvents: "none",
    position: "fixed",
    top: `${rect.top}px`,
    width: `${rect.width}px`,
  };
}

export function resolveOverlayElement(value: unknown): HTMLElement | undefined {
  if (value instanceof HTMLElement) return value;
  if (value && typeof value === "object" && "$el" in value) {
    const element = (value as { $el: unknown }).$el;
    if (element instanceof HTMLElement) return element;
  }
  return undefined;
}
