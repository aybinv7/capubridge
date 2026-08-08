import type { Component } from "vue";

import type {
  SurfaceLevelInput,
  SurfaceVariant,
  UiAccent,
  UiSize,
} from "../../foundations/contracts.ts";

export const buttonSpinnerSizes: Record<UiSize, UiSize> = {
  "2xs": "2xs",
  xs: "2xs",
  sm: "xs",
  md: "sm",
  lg: "md",
  xl: "lg",
  "2xl": "xl",
};

export const buttonIconSizes: Record<UiSize, string> = {
  "2xs": "[&>svg]:size-3",
  xs: "[&>svg]:size-3",
  sm: "[&>svg]:size-4",
  md: "[&>svg]:size-4",
  lg: "[&>svg]:size-4",
  xl: "[&>svg]:size-4",
  "2xl": "[&>svg]:size-4",
};

export const buttonPaddings: Record<UiSize, string> = {
  "2xs": "px-2.5",
  xs: "px-2.5",
  sm: "px-2.5",
  md: "px-2.5",
  lg: "px-2.5",
  xl: "px-2.5",
  "2xl": "px-3.5",
};

export const buttonFontSizes: Record<UiSize, string> = {
  "2xs": "text-cui-xs",
  xs: "text-cui-xs",
  sm: "text-cui-xs",
  md: "text-cui-xs",
  lg: "text-cui-xs",
  xl: "text-cui-xs",
  "2xl": "text-cui-xs",
};

export const buttonVerticalPaddings: Record<UiSize, string> = {
  "2xs": "py-0",
  xs: "py-0.5",
  sm: "py-1",
  md: "py-1",
  lg: "py-1",
  xl: "py-1",
  "2xl": "py-1",
};

export type ButtonSurface = "surface" | "cut";

export interface ButtonProps {
  accent?: UiAccent;
  /** Polymorphic root element. Defaults to `'button'`. */
  as?: string | Component;
  /** Default `true`. */
  clickable?: boolean;
  /** Accent color token. Sets the button's `cui-color-{name}` class. */
  color?: UiAccent;
  contentClassName?: string;
  disabled?: boolean;
  /** Default `true`. */
  focusable?: boolean;
  focused?: boolean;
  /** Default `true`. */
  hoverable?: boolean;
  loading?: boolean;
  multiline?: boolean;
  /** Default `true`. */
  outline?: boolean;
  pressed?: boolean;
  readOnly?: boolean;
  rounded?: boolean;
  /** Default `'md'`. */
  size?: UiSize;
  square?: boolean;
  /** `'surface'` (default) for a regular button, `'cut'` for an inset look. */
  surface?: ButtonSurface;
  surfaceLevel?: SurfaceLevelInput;
  tightFocusRing?: boolean;
  /** Default `'gradient'`. */
  variant?: SurfaceVariant;
}

export type ButtonDefaultProps = Partial<Omit<ButtonProps, "as">>;
