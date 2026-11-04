import type { VNodeChild } from 'vue';

import type {
  SurfaceLevelInput,
  SurfaceVariant,
} from '../foundations/contracts.ts';
import type { Color } from '../types.ts';
import type { OverlayRootProps } from './overlayRoot.ts';

export const popoverPositions = [
  'top-start',
  'top',
  'top-end',
  'bottom-start',
  'bottom',
  'bottom-end',
  'left-start',
  'left',
  'left-end',
  'right-start',
  'right',
  'right-end',
  'center',
] as const;

export type PopoverPosition = (typeof popoverPositions)[number];

export const tooltipPositions = ['top', 'bottom'] as const;

export type TooltipPosition = (typeof tooltipPositions)[number];

export type OverlayOffsetValue = number | string;

export type PopoverOffset =
  | OverlayOffsetValue
  | [OverlayOffsetValue, OverlayOffsetValue];

export type OverlayMarginProperty =
  | 'marginBottom'
  | 'marginLeft'
  | 'marginRight'
  | 'marginTop';

export interface PopoverPositionConfig {
  alignSelf?: string;
  area: string;
  centered?: boolean;
  justifySelf?: string;
  offsetProperties: [OverlayMarginProperty, OverlayMarginProperty];
  origin: string;
}

export const popoverPositionConfigs: Record<
  PopoverPosition,
  PopoverPositionConfig
> = {
  'top-start': {
    area: 'top center',
    justifySelf: 'start',
    origin: 'origin-bottom-left',
    offsetProperties: ['marginBottom', 'marginLeft'],
  },
  top: {
    area: 'top center',
    origin: 'origin-bottom',
    offsetProperties: ['marginBottom', 'marginLeft'],
  },
  'top-end': {
    area: 'top center',
    justifySelf: 'end',
    origin: 'origin-bottom-right',
    offsetProperties: ['marginBottom', 'marginRight'],
  },
  'bottom-start': {
    area: 'bottom center',
    justifySelf: 'start',
    origin: 'origin-top-left',
    offsetProperties: ['marginTop', 'marginLeft'],
  },
  bottom: {
    area: 'bottom center',
    origin: 'origin-top',
    offsetProperties: ['marginTop', 'marginLeft'],
  },
  'bottom-end': {
    area: 'bottom center',
    justifySelf: 'end',
    origin: 'origin-top-right',
    offsetProperties: ['marginTop', 'marginRight'],
  },
  'left-start': {
    area: 'center left',
    alignSelf: 'start',
    origin: 'origin-top-right',
    offsetProperties: ['marginRight', 'marginTop'],
  },
  left: {
    area: 'center left',
    origin: 'origin-right',
    offsetProperties: ['marginRight', 'marginTop'],
  },
  'left-end': {
    area: 'center left',
    alignSelf: 'end',
    origin: 'origin-bottom-right',
    offsetProperties: ['marginRight', 'marginBottom'],
  },
  'right-start': {
    area: 'center right',
    alignSelf: 'start',
    origin: 'origin-top-left',
    offsetProperties: ['marginLeft', 'marginTop'],
  },
  right: {
    area: 'center right',
    origin: 'origin-left',
    offsetProperties: ['marginLeft', 'marginTop'],
  },
  'right-end': {
    area: 'center right',
    alignSelf: 'end',
    origin: 'origin-bottom-left',
    offsetProperties: ['marginLeft', 'marginBottom'],
  },
  center: {
    area: 'center center',
    origin: 'origin-center',
    offsetProperties: ['marginTop', 'marginLeft'],
    centered: true,
  },
};

export const tooltipOrigins: Record<TooltipPosition, string> = {
  top: 'origin-bottom',
  bottom: 'origin-top',
};

export const overlayOppositeMargins: Record<
  OverlayMarginProperty,
  OverlayMarginProperty
> = {
  marginTop: 'marginBottom',
  marginBottom: 'marginTop',
  marginLeft: 'marginRight',
  marginRight: 'marginLeft',
};

export const popoverPositionTryFallbacks =
  'flip-block, flip-inline, flip-block flip-inline';

export const tooltipPositionTryFallbacks = 'flip-block';

export const popoverFallbackPosition: PopoverPosition = 'right-start';

export const popoverChildOverlaySelector = '.cladd-popover, .cladd-dialog';

/** Overlays that keep the app container inert once the dialog itself closes. */
export const dialogInertHoldSelector = '.cladd-dialog, .cladd-popup';

export const dialogChildOverlaySelector =
  '.cladd-popover, .cladd-dialog, .cladd-popup';

export const popoverContainerSelector = '.cladd-popover';

export const backdropClasses =
  'cladd-backdrop fixed inset-0 z-50 bg-cladd-backdrop/90';

export const overlayBackdropDurationClasses = 'duration-200';

export const overlayBackdropTransparentClasses = 'bg-transparent';

export const popoverBackdropTintClasses = 'bg-cladd-backdrop/50';

export const popoverContainerClasses = 'cladd-popover';

export const popoverSurfaceClasses =
  'pointer-events-auto absolute z-50 flex w-40 max-w-[calc(100vw-16px)] rounded-cladd-popover shadow-cladd-popover transition-[opacity,transform,scale] duration-0';

export const popoverOpenedClasses =
  'scale-100 opacity-100 ease-[cubic-bezier(0,1,0,1.025)]';

export const popoverEnterDurationClasses = 'duration-300';

export const popoverClosingClasses = 'duration-200 ease-in-out!';

export const popoverHiddenClasses = 'scale-0 opacity-0';

export const popoverContentClasses = 'h-auto max-h-[70vh] w-full overflow-auto';

export const tooltipContainerClasses = 'cladd-tooltip pointer-events-none';

export const tooltipSurfaceClasses =
  'pointer-events-none fixed max-h-[50vh] w-max max-w-50 overflow-auto rounded-cladd-tooltip text-cladd-xs leading-normal font-medium transition-[opacity,transform,scale]';

export const tooltipOpenedClasses = 'scale-100 opacity-100';

export const tooltipDurationClasses = 'duration-200';

export const tooltipHiddenClasses = 'scale-50 opacity-0';

export const tooltipZIndexClasses = 'z-50';

export const tooltipContentClasses = 'px-2 py-1';

export const dialogContainerClasses = 'cladd-dialog';

export const dialogSurfaceClasses =
  'fixed top-1/2 left-1/2 z-50 w-80 max-w-full -translate-x-1/2 -translate-y-1/2 rounded-cladd-dialog';

export const dialogHiddenClasses = 'scale-75 opacity-0 duration-200 ease-out!';

export const dialogOpenedClasses =
  'scale-100 opacity-100 duration-500 ease-[cubic-bezier(0,1,0.2,1.1)]';

export const dialogContentClasses = 'flex flex-col gap-4 p-4';

export const dialogTitleClasses = 'text-cladd-md font-semibold';

export const dialogTextClasses = 'text-cladd-sm leading-relaxed';

export const dialogButtonsClasses =
  'mt-4 flex flex-wrap items-center justify-end gap-2';

export const dialogButtonContentClasses = 'px-4';

export const overlayTriggerClasses = 'cladd-overlay-trigger contents';

export interface PopoverProps {
  /**
   * External anchor ref. When provided the trigger button is **not rendered** - the caller owns the trigger and `popoverState` wiring.
   */
  anchorElement?: HTMLElement;
  /** Alias for `anchorElement` — mirrors upstream `anchorRef` (React `RefObject`). */
  anchorRef?: HTMLElement;
  /** Anchor to a fixed rectangle instead of an element, for a context menu at a pointer position. Accepts `DOMRectReadOnly` or `Ref<DOMRectReadOnly>` to match upstream. */
  anchorRect?: DOMRectReadOnly | { value: DOMRectReadOnly };
  /** Render a backdrop behind the popover. Default `false`. */
  backdrop?: boolean;
  /** Render the backdrop without its tint, so the app stays visible behind the popover. */
  backdropTransparent?: boolean;
  /** Default `true`. */
  closeOnBackdropClick?: boolean;
  /** Default `true`. Suppressed automatically when this popover has a child popover/dialog open. */
  closeOnEscape?: boolean;
  /** Accent color token. Sets the popover's `cladd-color-{name}` class. */
  color?: Color;
  /** Extra classes for the inner scrollable content area. */
  contentClassName?: string;
  /** Whether the whole accordion is disabled. */
  disabled?: boolean;
  /** Set to `true` when rendered inside a lazy-loaded boundary so it opens on the next tick. */
  lazy?: boolean;
  /** Spacing from anchor. Either a single value (main axis) or `[main, cross]`. */
  offset?: PopoverOffset;
  /** Outline ring on the popover surface. Default `true` for non-light themes. */
  outline?: boolean;
  /** Anchor side + alignment, or `'center'`. Default `'bottom'`. */
  position?: PopoverPosition;
  /** Portal target. Default `'#app, #__next, #root'`. Pass `false` for inline (no portal) to match upstream `root: false`. */
  root?: string | HTMLElement | false;
  /** Forwarded to the underlying `Surface` as `level`. Default depends on theme. */
  surfaceLevel?: SurfaceLevelInput;
  /** Surface variant. Default depends on theme. */
  variant?: SurfaceVariant;
  /** Minimum gap (px) from the viewport edge. Default `4`. */
  viewportMargin?: number;
  /** Inherited from `SurfaceProps` via `PopoverProps & Omit<SurfaceProps, ...>` — extra classes for the background layer. */
  bgClassName?: string;
  /** Inherited from `SurfaceProps` — enables hover background overlay. */
  hoverable?: boolean;
  /** Inherited from `SurfaceProps` — enables active/pressed visual states. */
  clickable?: boolean;
  /** Inherited from `SurfaceProps` — force the pressed visual state. */
  pressed?: boolean;
  /** Inherited from `SurfaceProps` — where to stack the hover/press overlay. Default `'above'`. */
  overlayPosition?: 'above' | 'below';
  /** Inherited from `SurfaceProps` — extra classes for the hover/press overlay. */
  overlayClassName?: string;
  /** Inherited from `SurfaceProps` — polymorphpic root element for the surface (rarely needed, `Surface` default `'div'`). */
  as?: string;
  /** Inherited from `SurfaceProps` — wrap children in `SurfaceContent`. Default `true`. */
  wrapContent?: boolean;
}

export type PopoverDefaultProps = Partial<
  Omit<PopoverProps, 'anchorElement' | 'anchorRect'>
>;

export interface DialogProps {
  /** Render the backdrop without its tint, so the app stays visible behind the dialog. */
  backdropTransparent?: boolean;
  /** @deprecated Use `ariaLabel` — kebab `aria-label` alias for React migration. */
  'aria-label'?: string;
  /** @deprecated Use `ariaLabelledby` — kebab `aria-labelledby` alias. */
  'aria-labelledby'?: string;
  /** @deprecated Use `ariaDescribedby` — kebab `aria-describedby` alias. */
  'aria-describedby'?: string;
  /** ARIA label fallback when no title is set. Mirrors upstream `aria-label`. */
  ariaLabel?: string;
  /** Override auto-wired `aria-labelledby` (title id). */
  ariaLabelledby?: string;
  /** Override auto-wired `aria-describedby` (text id). */
  ariaDescribedby?: string;
  /** Custom button row — alias for the `buttons` slot. Mirrors upstream `buttons` ReactNode. */
  buttons?: unknown;
  /** Color for the cancel button. Default `'neutral'`. */
  cancelButtonColor?: Color;
  /** Label for the cancel button. When omitted, the cancel button is not rendered. Upstream `ReactNode` → `string | VNodeChild` + slot fallback. */
  cancelButtonText?: string | VNodeChild;
  /** Default `true`. */
  closeOnBackdropClick?: boolean;
  /** Default `true`. */
  closeOnEscape?: boolean;
  /** Accent color token. Sets the button's `cladd-color-{name}` class - drives text and ring colors. */
  color?: Color;
  /** Color for the confirm button. Default: theme accent color. */
  confirmButtonColor?: Color;
  /** Label for the confirm button. When omitted, the confirm button is not rendered. Upstream `ReactNode` → `string | VNodeChild` + slot fallback. */
  confirmButtonText?: string | VNodeChild;
  /** Extra classes applied to the inner content area. Default includes `flex flex-col gap-4 p-4`. */
  contentClassName?: string;
  /**
   * Selector for the container made `inert` while the dialog is open. Default `'.app-container'`.
   *
   * Used to block focus/interaction with the rest of the app while the modal is shown.
   */
  inertContainer?: string;
  /** Set to `true` when the dialog is rendered behind an async boundary so it opens on the next tick (after the chunk has resolved and mounted). */
  lazy?: boolean;
  /** Stop click propagation on backdrop and surface. Useful when the dialog is rendered inside a clickable parent. */
  stopPropagationOnClick?: boolean;
  /** Body text slot. Rendered as `<div>` with `text-cladd-sm leading-relaxed`. Auto-wired to `aria-describedby`. Upstream `ReactNode` → `string | VNodeChild` + `text` slot. */
  text?: string | VNodeChild;
  /** Outline ring on the dialog surface. Default `true` for dark, `false` for light. */
  outline?: boolean;
  /**
   * "Type to confirm" guard. When set, renders an `Input` and disables the confirm button until the user types this exact string - used for destructive actions (e.g. type the project name to delete).
   */
  requireConfirmText?: string;
  /** Portal target selector. Default `'#app, #__next, #root'` (first match wins). Pass `false` for inline (no portal) to match upstream `root: false`. */
  root?: string | HTMLElement | false;
  /** Forwarded to the underlying `Surface` as `level`. Default `1`. */
  surfaceLevel?: SurfaceLevelInput;
  /** Title slot. Rendered as `<div>` with `text-cladd-md font-semibold`. Auto-wired to `aria-labelledby`. Upstream `ReactNode` → `string | VNodeChild` + `title` slot. */
  title?: string | VNodeChild;
  /** Surface variant. Default depends on theme: `'solid'` for light, `'gradient'` for dark. */
  variant?: SurfaceVariant;
}

export type DialogDefaultProps = Partial<
  Omit<DialogProps, 'title' | 'text' | 'requireConfirmText'>
>;

export interface TooltipPrimitiveProps {
  /** Ref to the element the tooltip should anchor against (CSS anchor positioning). */
  anchorElement?: HTMLElement;
  /** Alias for `anchorElement` — mirrors upstream `anchorRef`. */
  anchorRef?: HTMLElement;
  /** Accent color token. Sets the tooltip's `cladd-color-{name}` class. */
  color?: Color;
  /** Extra classes applied to the inner content area. Default includes `px-2 py-1`. */
  contentClassName?: string;
  /** Distance from anchor in pixels (number) or any CSS length (`'8px'`, `'50%'`). Default `4`. */
  offset?: OverlayOffsetValue;
  /** Anchor side. Default `'top'`. */
  position?: TooltipPosition;
  /** Portal target selector. Default `'#app, #__next, #root'`. */
  root?: string | HTMLElement;
  /**
   * Forwarded to the underlying `Surface` as `level`.
   *
   * Default depends on theme: `1` for light theme, `5` for dark theme - so the tooltip pops on top of any surface.
   */
  surfaceLevel?: SurfaceLevelInput;
  /** Tailwind z-index utility for the tooltip surface. Default `'z-50'`. */
  zIndex?: string;
}

export type TooltipPrimitiveDefaultProps = Partial<
  Omit<TooltipPrimitiveProps, 'anchorElement'>
>;

export interface TooltipProps {
  /** The Vue spelling of upstream's `aria-label`. */
  ariaLabel?: string;
  /** Kebab alias for `ariaLabel` — `aria-label` as upstream spells it. */
  'aria-label'?: string;
  /** Accent color token. Sets the tooltip's `cladd-color-{name}` class. */
  color?: Color;
  /** Extra classes applied to the inner content area. Default includes `px-2 py-1`. */
  contentClassName?: string;
  /** Whether the whole accordion is disabled. */
  disabled?: boolean;
  /** Distance from anchor in pixels (number) or any CSS length (`'8px'`, `'50%'`). Default `4`. */
  offset?: OverlayOffsetValue;
  /** Composed onto the trigger — mirrors upstream `onClick` on the wrapper. */
  onClick?: (event: MouseEvent) => void;
  /** Anchor side. Default `'top'`. */
  position?: TooltipPosition;
  /** Portal target selector. Default `'#app, #__next, #root'`. */
  root?: string | HTMLElement;
  /**
   * Forwarded to the underlying `Surface` as `level`.
   *
   * Default depends on theme: `1` for light theme, `5` for dark theme - so the tooltip pops on top of any surface.
   */
  surfaceLevel?: SurfaceLevelInput;
  /** Delay showing the tooltip using a shared global timer. Default `true`. */
  timeout?: boolean;
  /** Content for the tooltip — mirrors upstream `tooltip` prop; also available via default slot. */
  tooltip?: string;
  /** Tailwind z-index utility for the tooltip surface. Default `'z-50'`. */
  zIndex?: string;
}

export type TooltipDefaultProps = Partial<TooltipProps>;

export function resolvePopoverOffset(
  value: OverlayOffsetValue,
  marginProperty: OverlayMarginProperty,
): string {
  if (typeof value === 'number') return `${value}px`;
  if (value.endsWith('%')) {
    const fraction = Number.parseFloat(value) / 100;
    const dimension =
      marginProperty === 'marginTop' || marginProperty === 'marginBottom'
        ? 'height'
        : 'width';
    return `calc(anchor-size(${dimension}) * ${fraction})`;
  }
  return value;
}

export function resolveTooltipOffset(value: OverlayOffsetValue): string {
  if (typeof value === 'number') return `${value}px`;
  if (value.endsWith('%')) {
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
    popoverPositionConfigs[options.position] ??
    popoverPositionConfigs[popoverFallbackPosition];
  const [mainOffset, crossOffset] = Array.isArray(options.offset)
    ? options.offset
    : [options.offset ?? 0, 0];
  const [mainProperty, crossProperty] = config.offsetProperties;
  const centered = !config.justifySelf && !config.alignSelf;
  const viewportMargin =
    options.viewportMargin > 0 ? `${options.viewportMargin}px` : undefined;
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

  if (mainOffset)
    style[mainProperty] = resolvePopoverOffset(mainOffset, mainProperty);
  if (crossOffset)
    style[crossProperty] = resolvePopoverOffset(crossOffset, crossProperty);

  return style;
}

export function buildTooltipPositionStyle(options: {
  anchorName: string;
  offset?: OverlayOffsetValue;
  position: TooltipPosition;
}): Record<string, string> {
  const isTop = options.position === 'top';
  const style: Record<string, string> = {
    positionAnchor: options.anchorName,
    positionArea: isTop ? 'top center' : 'bottom center',
    positionTryFallbacks: tooltipPositionTryFallbacks,
  };

  if (options.offset) {
    style[isTop ? 'marginBottom' : 'marginTop'] = resolveTooltipOffset(
      options.offset,
    );
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
    pointerEvents: 'none',
    position: 'fixed',
    top: `${rect.top}px`,
    width: `${rect.width}px`,
  };
}

export function resolveOverlayElement(value: unknown): HTMLElement | undefined {
  if (value instanceof HTMLElement) return value;
  if (value && typeof value === 'object' && '$el' in value) {
    const element = (value as { $el: unknown }).$el;
    if (element instanceof HTMLElement) return element;
  }
  return undefined;
}

/** Stateful, non-visual root that owns a `Dialog`'s open state. */
export type DialogRootProps = OverlayRootProps;

/** Takes no own props; upstream's are the native element props plus `children` and `ref`. */
export type DialogTriggerProps = Record<string, never>;

/** Takes no own props; upstream's are the native element props plus `children` and `ref`. */
export type DialogCloseProps = Record<string, never>;

/** Stateful, non-visual root that owns a `Popover`'s open state. */
export type PopoverRootProps = OverlayRootProps;

/** Takes no own props; upstream's are the native element props plus `children` and `ref`. */
export type PopoverTriggerProps = Record<string, never>;

/** Takes no own props; upstream's are the native element props plus `children` and `ref`. */
export type PopoverCloseProps = Record<string, never>;

export interface BackdropProps {
  /** Extra classes applied to the backdrop. */
  className?: string;
}

/** Shape of `Backdrop` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type BackdropDefaultProps = Partial<BackdropProps>;
