import type { Component } from 'vue';

import type {
  SurfaceLevelInput,
  SurfaceVariant,
} from '../foundations/contracts.ts';
import type { Color } from '../types.ts';

/** Button size token, spelled out as upstream declares it. */
export type ButtonSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export const buttonSpinnerSizes: Record<ButtonSize, ButtonSize> = {
  '2xs': '2xs',
  xs: '2xs',
  sm: 'xs',
  md: 'sm',
  lg: 'md',
  xl: 'lg',
  '2xl': 'xl',
};

export const buttonIconSizes: Record<ButtonSize, string> = {
  '2xs': '[&>svg]:size-3',
  xs: '[&>svg]:size-3',
  sm: '[&>svg]:size-4',
  md: '[&>svg]:size-4',
  lg: '[&>svg]:size-4',
  xl: '[&>svg]:size-4',
  '2xl': '[&>svg]:size-4',
};

export const buttonPaddings: Record<ButtonSize, string> = {
  '2xs': 'px-2.5',
  xs: 'px-2.5',
  sm: 'px-2.5',
  md: 'px-2.5',
  lg: 'px-2.5',
  xl: 'px-2.5',
  '2xl': 'px-3.5',
};

export const buttonFontSizes: Record<ButtonSize, string> = {
  '2xs': 'text-cladd-xs',
  xs: 'text-cladd-xs',
  sm: 'text-cladd-xs',
  md: 'text-cladd-xs',
  lg: 'text-cladd-xs',
  xl: 'text-cladd-xs',
  '2xl': 'text-cladd-xs',
};

export const buttonVerticalPaddings: Record<ButtonSize, string> = {
  '2xs': 'py-0',
  xs: 'py-0.5',
  sm: 'py-1',
  md: 'py-1',
  lg: 'py-1',
  xl: 'py-1',
  '2xl': 'py-1',
};

export type ButtonSurface = 'surface' | 'cut';

export interface ButtonProps {
  /** Polymorphic root element. Defaults to `'button'`. */
  as?: string | Component;
  /** Default `true`. */
  clickable?: boolean;
  /** Accent color token. Sets the button's `cladd-color-{name}` class. */
  color?: Color;
  /** Extra classes for the inner content row. */
  contentClassName?: string;
  /** Visually dim the button (40% opacity) and disable pointer events. */
  disabled?: boolean;
  /** Default `true`. */
  focusable?: boolean;
  /** Force the focus ring on, regardless of actual keyboard focus. */
  focused?: boolean;
  /** Default `true`. */
  hoverable?: boolean;
  /** Show a centered `Spinner` overlay and fade the button's content out. Also sets `data-loading` for styling hooks. */
  loading?: boolean;
  /** Allow text to wrap onto multiple lines, switching height to `min-h-*` and using pill radii compatible with multi-line content. */
  multiline?: boolean;
  /** Default `true`. */
  outline?: boolean;
  /** Force the pressed visual state, regardless of pointer activity. */
  pressed?: boolean;
  /** Block clicks while keeping the button visually enabled - useful for "selected" segmented buttons. */
  readOnly?: boolean;
  /** When `true`, applies fully rounded corners (`rounded-full`, or matching pill radius for `multiline`).
   *
   * Default size-specific corner radii are used when `false`.
   */
  rounded?: boolean;
  /** Default `'md'`. */
  size?: ButtonSize;
  /** Render as an icon-only square button: forces `aspect-square` and drops horizontal padding. */
  square?: boolean;
  /** `'surface'` (default) for a regular button, `'cut'` for an inset look. */
  surface?: ButtonSurface;
  /** Forwarded to the underlying `Surface` as `level` - see `SurfaceProps.level` for the relative-offset (`"+1"`/`"-1"`) syntax. */
  surfaceLevel?: SurfaceLevelInput;
  /** Render the focus ring flush against the element (`inset-0`) instead of offset outside it (`-inset-1.5`). Use when the button sits at the edge of an `overflow` container, where the offset ring would add unwanted scroll overflow. Default `false`. */
  tightFocusRing?: boolean;
  /** Default `'gradient'`. */
  variant?: SurfaceVariant;
}

export type ButtonDefaultProps = Partial<Omit<ButtonProps, 'as'>>;
