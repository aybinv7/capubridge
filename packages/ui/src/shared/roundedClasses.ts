import type { UiSize } from "../foundations/contracts.ts";

export interface RoundedClasses {
  focusRoundedClasses: string;
  itemRoundedClasses: string;
  wrapRoundedClasses: string;
}

const itemClasses: Record<UiSize, string> = {
  "2xs": "rounded-cui-2xs",
  xs: "rounded-cui-xs",
  sm: "rounded-cui-sm",
  md: "rounded-cui-md",
  lg: "rounded-cui-lg",
  xl: "rounded-cui-xl",
  "2xl": "rounded-cui-2xl",
};

const itemFullClasses: Record<UiSize, string> = {
  "2xs": "rounded-cui-full-2xs",
  xs: "rounded-cui-full-xs",
  sm: "rounded-cui-full-sm",
  md: "rounded-cui-full-md",
  lg: "rounded-cui-full-lg",
  xl: "rounded-cui-full-xl",
  "2xl": "rounded-cui-full-2xl",
};

const focusClasses: Record<UiSize, string> = {
  "2xs": "rounded-cui-focus-2xs",
  xs: "rounded-cui-focus-xs",
  sm: "rounded-cui-focus-sm",
  md: "rounded-cui-focus-md",
  lg: "rounded-cui-focus-lg",
  xl: "rounded-cui-focus-xl",
  "2xl": "rounded-cui-focus-2xl",
};

const focusFullClasses: Record<UiSize, string> = {
  "2xs": "rounded-cui-focus-full-2xs",
  xs: "rounded-cui-focus-full-xs",
  sm: "rounded-cui-focus-full-sm",
  md: "rounded-cui-focus-full-md",
  lg: "rounded-cui-focus-full-lg",
  xl: "rounded-cui-focus-full-xl",
  "2xl": "rounded-cui-focus-full-2xl",
};

const wrapClasses: Record<UiSize, string> = {
  "2xs": "rounded-cui-wrap-2xs",
  xs: "rounded-cui-wrap-xs",
  sm: "rounded-cui-wrap-sm",
  md: "rounded-cui-wrap-md",
  lg: "rounded-cui-wrap-lg",
  xl: "rounded-cui-wrap-xl",
  "2xl": "rounded-cui-wrap-2xl",
};

const wrapFullClasses: Record<UiSize, string> = {
  "2xs": "rounded-cui-wrap-full-2xs",
  xs: "rounded-cui-wrap-full-xs",
  sm: "rounded-cui-wrap-full-sm",
  md: "rounded-cui-wrap-full-md",
  lg: "rounded-cui-wrap-full-lg",
  xl: "rounded-cui-wrap-full-xl",
  "2xl": "rounded-cui-wrap-full-2xl",
};

function resolve(
  size: UiSize,
  sized: Record<UiSize, string>,
  full: Record<UiSize, string>,
  rounded?: boolean,
  multiline?: boolean,
): string {
  if (rounded && multiline) return full[size];
  if (rounded) return "rounded-full";
  return sized[size];
}

export function roundedClasses(
  size: UiSize,
  rounded?: boolean,
  multiline?: boolean,
): RoundedClasses {
  return {
    itemRoundedClasses: resolve(size, itemClasses, itemFullClasses, rounded, multiline),
    focusRoundedClasses: resolve(size, focusClasses, focusFullClasses, rounded, multiline),
    wrapRoundedClasses: resolve(size, wrapClasses, wrapFullClasses, rounded, multiline),
  };
}
