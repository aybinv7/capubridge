import type { SurfaceLevelInput, SurfaceVariant, UiAccent } from "../../foundations/contracts.ts";

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
  origin: string;
}

export const popoverPositionConfigs: Record<PopoverPosition, PopoverPositionConfig> = {
  "top-start": {
    area: "top center",
    justifySelf: "start",
    origin: "origin-bottom-left",
    offsetProperties: ["marginBottom", "marginLeft"],
  },
  top: {
    area: "top center",
    origin: "origin-bottom",
    offsetProperties: ["marginBottom", "marginLeft"],
  },
  "top-end": {
    area: "top center",
    justifySelf: "end",
    origin: "origin-bottom-right",
    offsetProperties: ["marginBottom", "marginRight"],
  },
  "bottom-start": {
    area: "bottom center",
    justifySelf: "start",
    origin: "origin-top-left",
    offsetProperties: ["marginTop", "marginLeft"],
  },
  bottom: {
    area: "bottom center",
    origin: "origin-top",
    offsetProperties: ["marginTop", "marginLeft"],
  },
  "bottom-end": {
    area: "bottom center",
    justifySelf: "end",
    origin: "origin-top-right",
    offsetProperties: ["marginTop", "marginRight"],
  },
  "left-start": {
    area: "center left",
    alignSelf: "start",
    origin: "origin-top-right",
    offsetProperties: ["marginRight", "marginTop"],
  },
  left: {
    area: "center left",
    origin: "origin-right",
    offsetProperties: ["marginRight", "marginTop"],
  },
  "left-end": {
    area: "center left",
    alignSelf: "end",
    origin: "origin-bottom-right",
    offsetProperties: ["marginRight", "marginBottom"],
  },
  "right-start": {
    area: "center right",
    alignSelf: "start",
    origin: "origin-top-left",
    offsetProperties: ["marginLeft", "marginTop"],
  },
  right: {
    area: "center right",
    origin: "origin-left",
    offsetProperties: ["marginLeft", "marginTop"],
  },
  "right-end": {
    area: "center right",
    alignSelf: "end",
    origin: "origin-bottom-left",
    offsetProperties: ["marginLeft", "marginBottom"],
  },
  center: {
    area: "center center",
    origin: "origin-center",
    offsetProperties: ["marginTop", "marginLeft"],
    centered: true,
  },
};

export const tooltipOrigins: Record<TooltipPosition, string> = {
  top: "origin-bottom",
  bottom: "origin-top",
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

export const backdropClasses = "cui-backdrop fixed inset-0 z-50 bg-cui-backdrop/90";

export const overlayBackdropDurationClasses = "duration-200";

export const overlayBackdropTransparentClasses = "bg-transparent";

export const popoverBackdropTintClasses = "bg-cui-backdrop/50";

export const popoverContainerClasses = "cui-popover";

export const popoverSurfaceClasses =
  "pointer-events-auto absolute z-50 flex w-40 max-w-[calc(100vw-16px)] rounded-cui-popover shadow-cui-popover transition-[opacity,transform,scale] duration-0";

export const popoverOpenedClasses = "scale-100 opacity-100 ease-[cubic-bezier(0,1,0,1.025)]";

export const popoverEnterDurationClasses = "duration-300";

export const popoverClosingClasses = "duration-200 ease-in-out!";

export const popoverHiddenClasses = "scale-0 opacity-0";

export const popoverContentClasses = "h-auto max-h-[70vh] w-full overflow-auto";

export const tooltipContainerClasses = "cui-tooltip pointer-events-none";

export const tooltipSurfaceClasses =
  "pointer-events-none fixed max-h-[50vh] w-max max-w-50 overflow-auto rounded-cui-tooltip text-cui-xs leading-normal font-medium transition-[opacity,transform,scale]";

export const tooltipOpenedClasses = "scale-100 opacity-100";

export const tooltipDurationClasses = "duration-200";

export const tooltipHiddenClasses = "scale-50 opacity-0";

export const tooltipZIndexClasses = "z-50";

export const tooltipContentClasses = "px-2 py-1";

export const dialogContainerClasses = "cui-dialog";

export const dialogSurfaceClasses =
  "fixed top-1/2 left-1/2 z-50 w-80 max-w-full -translate-x-1/2 -translate-y-1/2 rounded-cui-dialog";

export const dialogHiddenClasses = "scale-75 opacity-0 duration-200 ease-out!";

export const dialogOpenedClasses =
  "scale-100 opacity-100 duration-500 ease-[cubic-bezier(0,1,0.2,1.1)]";

export const dialogContentClasses = "flex flex-col gap-4 p-4";

export const dialogTitleClasses = "text-cui-md font-semibold";

export const dialogTextClasses = "text-cui-sm leading-relaxed";

export const dialogButtonsClasses = "mt-4 flex flex-wrap items-center justify-end gap-2";

export const dialogButtonContentClasses = "px-4";

export const overlayTriggerClasses = "cui-overlay-trigger contents";

export interface PopoverProps {
  accent?: UiAccent;
  anchorElement?: HTMLElement;
  anchorRect?: DOMRectReadOnly;
  /** Render a backdrop behind the popover. Default `false`. */
  backdrop?: boolean;
  backdropTransparent?: boolean;
  /** Default `true`. */
  closeOnBackdropClick?: boolean;
  /** Default `true`. Suppressed automatically when this popover has a child popover/dialog open. */
  closeOnEscape?: boolean;
  /** Accent color token. Sets the popover's `cui-color-{name}` class. */
  color?: UiAccent;
  /** Extra classes for the inner scrollable content area. */
  contentClassName?: string;
  disabled?: boolean;
  /** Set to `true` when rendered inside a lazy-loaded boundary so it opens on the next tick. */
  lazy?: boolean;
  /** Spacing from anchor. Either a single value (main axis) or `[main, cross]`. */
  offset?: PopoverOffset;
  /** Outline ring on the popover surface. Default `true` for non-light themes. */
  outline?: boolean;
  /** Anchor side + alignment, or `'center'`. Default `'bottom'`. */
  position?: PopoverPosition;
  /** Portal target. Default `'#app, #__next, #root'`. */
  root?: string | HTMLElement;
  /** Forwarded to the underlying `Surface` as `level`. Default depends on theme. */
  surfaceLevel?: SurfaceLevelInput;
  /** Surface variant. Default depends on theme. */
  variant?: SurfaceVariant;
  /** Minimum gap (px) from the viewport edge. Default `4`. */
  viewportMargin?: number;
}

export type PopoverDefaultProps = Partial<Omit<PopoverProps, "anchorElement" | "anchorRect">>;

export interface DialogProps {
  accent?: UiAccent;
  backdropTransparent?: boolean;
  cancelAccent?: UiAccent;
  cancelText?: string;
  /** Default `true`. */
  closeOnBackdropClick?: boolean;
  /** Default `true`. */
  closeOnEscape?: boolean;
  color?: UiAccent;
  confirmAccent?: UiAccent;
  confirmText?: string;
  contentClassName?: string;
  description?: string;
  /** Outline ring on the dialog surface. Default `true` for dark, `false` for light. */
  outline?: boolean;
  requireConfirmText?: string;
  root?: string | HTMLElement;
  surfaceLevel?: SurfaceLevelInput;
  title?: string;
  variant?: SurfaceVariant;
}

export type DialogDefaultProps = Partial<
  Omit<DialogProps, "title" | "description" | "requireConfirmText">
>;

export interface TooltipPrimitiveProps {
  accent?: UiAccent;
  anchorElement?: HTMLElement;
  color?: UiAccent;
  contentClassName?: string;
  offset?: OverlayOffsetValue;
  position?: TooltipPosition;
  root?: string | HTMLElement;
  surfaceLevel?: SurfaceLevelInput;
  zIndex?: string;
}

export type TooltipPrimitiveDefaultProps = Partial<Omit<TooltipPrimitiveProps, "anchorElement">>;

export interface TooltipProps {
  accent?: UiAccent;
  ariaLabel?: string;
  color?: UiAccent;
  contentClassName?: string;
  disabled?: boolean;
  offset?: OverlayOffsetValue;
  position?: TooltipPosition;
  root?: string | HTMLElement;
  surfaceLevel?: SurfaceLevelInput;
  /** Delay showing the tooltip using a shared global timer. Default `true`. */
  timeout?: boolean;
  zIndex?: string;
}

export type TooltipDefaultProps = Partial<TooltipProps>;

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
