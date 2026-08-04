import type { UiSize } from "../../foundations/contracts.ts";

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
