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

export type ButtonSurface = "surface" | "cut";
