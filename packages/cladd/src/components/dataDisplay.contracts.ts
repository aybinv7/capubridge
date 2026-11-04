import type { Component } from 'vue';

import type {
  SurfaceLevelInput,
  SurfaceVariant,
  UiSize,
} from '../foundations/contracts.ts';
import type { Color } from '../types.ts';

/** Shortcut size token, spelled out as upstream declares it. */
export type ShortcutSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/** Chip size token, spelled out as upstream declares it. */
export type ChipSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface ChipProps {
  /** Polymorphic root element. Defaults to `'span'`. */
  as?: string | Component;
  /**
   * Make the chip react to pointer activity (active/pressed state, hover overlay).
   *
   * Auto-computed when omitted: `true` if `as === 'a'` or `'button'`, otherwise `false`.
   *
   * Set explicitly to override (e.g. force a `<span>` to be clickable, or suppress the default for an `<a>` used purely as a navigation anchor).
   */
  clickable?: boolean;
  /** Accent color token. Sets the chip's `cladd-color-{name}` class - drives text and ring colors. */
  color?: Color;
  /** Extra classes for the inner content row. */
  contentClassName?: string;
  /** Currently unused in styling - reserved for future "disabled chip" state. */
  disabled?: boolean;
  /** Show hover affordance. Implicitly enabled when the chip is clickable. */
  hoverable?: boolean;
  /** Icon component rendered before `children`. Receives `iconProps`. */
  icon?: Component;
  /** Props forwarded to the `icon` component. */
  iconProps?: Record<string, unknown>;
  /** Render the outline ring. Default `true`. */
  outline?: boolean;
  /** Apply `rounded-full` (pill) corners. When `false` (default), uses size-specific corner radii. */
  rounded?: boolean;
  /** Default `'md'`. */
  size?: UiSize;
  /** Forwarded to the underlying `Surface` as `level` - see `SurfaceProps.level` for the relative-offset (`"+1"`/`"-1"`) syntax. */
  surfaceLevel?: SurfaceLevelInput;
  /** Default `'gradient'`. */
  variant?: SurfaceVariant;
}

export type ChipDefaultProps = Partial<
  Omit<ChipProps, 'as' | 'icon' | 'iconProps'>
>;

export interface ShortcutProps {
  /**
   * Polymorphic root element. Defaults to `'div'`. Use `'span'` when rendering inline (e.g. inside a `<p>`) to keep valid HTML.
   */
  as?: string | Component;
  /** Accent color token applied to each key surface. */
  color?: Color;
  /** Extra classes for keyboard icon glyphs (cmd, shift, arrows, etc.). */
  iconClassName?: string;
  /** Extra classes for each individual key surface. */
  keyClassName?: string;
  /** Extra classes for the inner content of each key. */
  keyContentClassName?: string;
  /** Render an outline ring on each key surface. Default `true`. */
  outline?: boolean;
  /** Key dimension. Default `'md'`. Drives height, font size, icon size, and corner radius. */
  size?: UiSize;
  /**
   * Surface level for each key. Default `'+2'`.
   *
   * Accepts the same absolute / relative (`"+1"`/`"-1"`) syntax as `Surface.level`.
   */
  surfaceLevel?: SurfaceLevelInput;
  /** Surface variant for each key. Default `'gradient'`. */
  variant?: SurfaceVariant;
}

export type ShortcutDefaultProps = Partial<Omit<ShortcutProps, 'as'>>;

export interface ListButtonProps {
  /** Polymorphic root element. Defaults to `'button'`. Pass `'a'` for navigation rows. */
  as?: string | Component;
  /** Accent color token. Forwarded to `Button.color`. */
  color?: Color;
  /** Extra classes for the row's inner content area. */
  contentClassName?: string;
  /** Visually dim the row and disable pointer events. */
  disabled?: boolean;
  /** Small text rendered below the title. Upstream `ReactNode` → `string | VNodeChild` + `footer` slot, declared as `string` for convenience. */
  footer?: string;
  /** Extra classes for the `footer` element. */
  footerClassName?: string;
  /** Small text rendered above the title. Upstream `ReactNode` → `string | VNodeChild` + `header` slot. */
  header?: string;
  /** Extra classes for the `header` element. */
  headerClassName?: string;
  /** Extra classes for the icon wrapper. */
  iconClassName?: string;
  /** Extra classes for the inner column (the wrapper around `header`/title/`footer`). */
  innerContentClassName?: string;
  /** Effective value is `outline || selected`. Default `false`. */
  outline?: boolean;
  /** Block clicks while keeping the row visually enabled. */
  readOnly?: boolean;
  /** Default `true`. */
  rounded?: boolean;
  /** Forces `variant: 'gradient'` and `outline: true`. */
  selected?: boolean;
  /** Default `'lg'` (vs Button's `'md'`) — list rows want more vertical space. */
  size?: UiSize;
  /** Extra classes for the title row (the wrapper around `children`). */
  titleClassName?: string;
  /** Default `'transparent'` so rows blend into the list surface. */
  variant?: SurfaceVariant;
  /** Inherited from `ButtonProps` via `ListButtonProps & Omit<ButtonProps, ...>` — enables active states. Default `true`. */
  clickable?: boolean;
  /** Inherited from `ButtonProps` — whether row can receive focus. Default `true`. */
  focusable?: boolean;
  /** Inherited from `ButtonProps` — enable hover overlay. Default `true`. */
  hoverable?: boolean;
  /** Inherited from `ButtonProps` — show spinner overlay. */
  loading?: boolean;
  /** Inherited from `ButtonProps` — force pressed visual state. */
  pressed?: boolean;
  /** Inherited from `ButtonProps` — render focus ring flush inside. Default `false`. */
  tightFocusRing?: boolean;
  /** Inherited from `ButtonProps` — forwarded to underlying `Surface` as `level`. */
  surfaceLevel?: SurfaceLevelInput;
}

export type ListButtonDefaultProps = Partial<
  Omit<ListButtonProps, 'as' | 'footer' | 'header' | 'selected'>
>;

/** `List`, `ListItem`, `ListTitle`, `ListSeparator` and `SectionTitle` take no props of their own
 * upstream beyond `className`/`children`, which Vue carries as attrs and the default slot. Their
 * registry entries exist so `defaults` can still target them once they gain props. */
export interface ListDefaultProps {
  /** Extra classes applied to the list root. */
  className?: string;
}

export interface ListItemDefaultProps {
  /** Extra classes applied to the list item. */
  className?: string;
}

export interface ListTitleDefaultProps {
  /** Extra classes applied to the list title. */
  className?: string;
}

export interface ListSeparatorDefaultProps {
  /** Extra classes applied to the list separator. */
  className?: string;
}

export interface SectionTitleDefaultProps {
  /** Extra classes applied to the section title. */
  className?: string;
}

/** Props for the section title primitive. */
export interface SectionTitleProps {
  /** Extra classes applied to the section title. */
  className?: string;
}
