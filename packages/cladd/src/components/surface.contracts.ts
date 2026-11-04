import type { Component } from 'vue';

import type {
  SurfaceLevelInput,
  SurfaceVariant,
} from '../foundations/contracts.ts';
import type { Color } from '../types.ts';

export interface SurfaceProps {
  /** Polymorphic root element. Defaults to `'div'`. */
  as?: string | Component;
  /** Extra classes for the absolutely-positioned background layer (the tinted/outlined fill behind content). */
  bgClassName?: string;
  /** Enables active/pressed visual states (scale + pressed background). Combine with `hoverable`. */
  clickable?: boolean;
  /** Accent color token. Sets the surface's `cladd-color-{name}` class. */
  color?: Color;
  /** Extra classes for the inner `SurfaceContent` wrapper. Ignored when `wrapContent` is `false`. */
  contentClassName?: string;
  /** Enables hover background overlay. For `variant="transparent"`, also reveals the surface fill on hover. */
  hoverable?: boolean;
  /** Absolute (1–5) or relative (`'+1'`/`'-1'`) depth. Defaults to parent + 1. */
  level?: SurfaceLevelInput;
  /** Render the outline ring. Default `false`. */
  outline?: boolean;
  /** Extra classes for the hover/press overlay layer. */
  overlayClassName?: string;
  /** Default `'above'`. */
  overlayPosition?: 'above' | 'below';
  /** Force the pressed visual state regardless of pointer activity (controlled press). */
  pressed?: boolean;
  /** Default `'solid'`. */
  variant?: SurfaceVariant;
  /** Wrap children in the content layer. Default `true`. */
  wrapContent?: boolean;
}

export type SurfaceDefaultProps = Partial<Omit<SurfaceProps, 'as' | 'level'>>;

export interface SurfaceCutProps {
  /** Polymorphic root element. Defaults to `'div'`. */
  as?: string | Component;
  /** Extra classes for the absolutely-positioned background layer (the cut fill behind content). */
  bgClassName?: string;
  /** Enable active/pressed visual states (scale + pressed background). Default `false`. */
  clickable?: boolean;
  /** Accent color token. Sets the surface's `cladd-color-{name}` class. */
  color?: Color;
  /** Extra classes for the inner `SurfaceCutContent` wrapper. Ignored when `wrapContent` is `false`. */
  contentClassName?: string;
  /** Show hover overlay on the cut surface. Default `false`. */
  hoverable?: boolean;
  /** Render the inset outline ring. Default `true`. */
  outline?: boolean;
  /** Extra classes for the hover/press overlay layer. */
  overlayClassName?: string;
  /**
   * Where to stack the hover/press overlay:
   * - `'below'` (default) - inside the background layer, behind content (overlay tints only the bg).
   * - `'above'` - on top of content as a separate sibling layer (overlay tints content too).
   */
  overlayPosition?: 'above' | 'below';
  /** Force the pressed visual state regardless of pointer activity. */
  pressed?: boolean;
  /**
   * When `true` (default), `children` are wrapped in `SurfaceCutContent`.
   *
   * Set to `false` to render `children` directly when you need full layout control of the inner DOM.
   */
  wrapContent?: boolean;
}

export type SurfaceCutDefaultProps = Partial<Omit<SurfaceCutProps, 'as'>>;

export interface SurfaceContentProps {
  /**
   * Polymorphic root element. Defaults to `'div'`.
   *
   * `Surface` passes `'span'` automatically when the surface renders as phrasing content (e.g. `as="kbd"`), so the wrapper stays valid inside `<p>`, `<button>`, etc.
   */
  as?: string | Component;
}

/** Shape of `SurfaceContent` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type SurfaceContentDefaultProps = Partial<
  Omit<SurfaceContentProps, 'as'>
>;

export interface SurfaceCutContentProps {
  /** Polymorphic root element. Defaults to `'div'`. */
  as?: string | Component;
  /** Stretch the content to `h-full`. Default `true`. Set `false` for content sized by intrinsic height. */
  fullHeight?: boolean;
}

/** Shape of `SurfaceCutContent` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type SurfaceCutContentDefaultProps = Partial<
  Omit<SurfaceCutContentProps, 'as'>
>;
