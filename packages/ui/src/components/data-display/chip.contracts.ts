import type { UiSize } from "../../foundations/contracts.ts";

export const chipPaddings: Record<UiSize, string> = {
  "2xs": "px-1 [&:has(>svg:first-child)]:pl-1 [&:has(>svg:last-child)]:pr-1",
  xs: "px-1 [&:has(>svg:first-child)]:pl-1 [&:has(>svg:last-child)]:pr-1",
  sm: "px-2 [&:has(>svg:first-child)]:pl-1.5 [&:has(>svg:last-child)]:pr-1.5",
  md: "px-2 [&:has(>svg:first-child)]:pl-1.5 [&:has(>svg:last-child)]:pr-1.5",
  lg: "px-2.5 [&:has(>svg:first-child)]:pl-2 [&:has(>svg:last-child)]:pr-2",
  xl: "px-2.5 [&:has(>svg:first-child)]:pl-2 [&:has(>svg:last-child)]:pr-2",
  "2xl": "px-2.5",
};

export const chipFontSizes: Record<UiSize, string> = {
  "2xs": "text-cui-4xs",
  xs: "text-cui-3xs",
  sm: "text-cui-2xs",
  md: "text-cui-2xs",
  lg: "text-cui-xs",
  xl: "text-cui-xs",
  "2xl": "text-cui-xs",
};

export const chipIconSizes: Record<UiSize, string> = {
  "2xs": "[&>svg]:size-1.5",
  xs: "[&>svg]:size-2.5",
  sm: "[&>svg]:size-3",
  md: "[&>svg]:size-3.5",
  lg: "[&>svg]:size-4",
  xl: "[&>svg]:size-4",
  "2xl": "[&>svg]:size-4",
};

export const chipRoundedClasses: Record<UiSize, string> = {
  "2xs": "rounded-cui-3xs",
  xs: "rounded-cui-3xs",
  sm: "rounded-cui-xs",
  md: "rounded-cui-sm",
  lg: "rounded-cui-md",
  xl: "rounded-cui-lg",
  "2xl": "rounded-cui-xl",
};
