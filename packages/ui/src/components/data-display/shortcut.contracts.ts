import type { UiSize } from "../../foundations/contracts.ts";

export const shortcutIconSizes: Record<UiSize, string> = {
  "2xs": "size-1.5",
  xs: "size-2.5",
  sm: "size-3",
  md: "size-3.5",
  lg: "size-4",
  xl: "size-5",
  "2xl": "size-6",
};

export const shortcutRoundedClasses: Record<UiSize, string> = {
  "2xs": "rounded-cui-3xs",
  xs: "rounded-cui-2xs",
  sm: "rounded-cui-xs",
  md: "rounded-cui-sm",
  lg: "rounded-cui-md",
  xl: "rounded-cui-lg",
  "2xl": "rounded-cui-xl",
};

export const shortcutFontSizes: Record<UiSize, string> = {
  "2xs": "text-cui-4xs",
  xs: "text-cui-3xs",
  sm: "text-cui-2xs",
  md: "text-cui-xs",
  lg: "text-cui-xs",
  xl: "text-cui-sm",
  "2xl": "text-cui-md",
};
