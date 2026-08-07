import type { UiSize } from "../foundations/contracts.ts";

export type SizeClassProperty = "size" | "width" | "height" | "min-width" | "min-height";

const rootClasses: Record<SizeClassProperty, Record<UiSize, string>> = {
  size: {
    "2xs": "size-cui-2xs",
    xs: "size-cui-xs",
    sm: "size-cui-sm",
    md: "size-cui-md",
    lg: "size-cui-lg",
    xl: "size-cui-xl",
    "2xl": "size-cui-2xl",
  },
  width: {
    "2xs": "w-cui-2xs",
    xs: "w-cui-xs",
    sm: "w-cui-sm",
    md: "w-cui-md",
    lg: "w-cui-lg",
    xl: "w-cui-xl",
    "2xl": "w-cui-2xl",
  },
  height: {
    "2xs": "h-cui-2xs",
    xs: "h-cui-xs",
    sm: "h-cui-sm",
    md: "h-cui-md",
    lg: "h-cui-lg",
    xl: "h-cui-xl",
    "2xl": "h-cui-2xl",
  },
  "min-width": {
    "2xs": "min-w-cui-2xs",
    xs: "min-w-cui-xs",
    sm: "min-w-cui-sm",
    md: "min-w-cui-md",
    lg: "min-w-cui-lg",
    xl: "min-w-cui-xl",
    "2xl": "min-w-cui-2xl",
  },
  "min-height": {
    "2xs": "min-h-cui-2xs",
    xs: "min-h-cui-xs",
    sm: "min-h-cui-sm",
    md: "min-h-cui-md",
    lg: "min-h-cui-lg",
    xl: "min-h-cui-xl",
    "2xl": "min-h-cui-2xl",
  },
};

const nestedClasses: Record<SizeClassProperty, Record<UiSize, string>> = {
  size: {
    "2xs": "size-cui-nested-2xs",
    xs: "size-cui-nested-xs",
    sm: "size-cui-nested-sm",
    md: "size-cui-nested-md",
    lg: "size-cui-nested-lg",
    xl: "size-cui-nested-xl",
    "2xl": "size-cui-nested-2xl",
  },
  width: {
    "2xs": "w-cui-nested-2xs",
    xs: "w-cui-nested-xs",
    sm: "w-cui-nested-sm",
    md: "w-cui-nested-md",
    lg: "w-cui-nested-lg",
    xl: "w-cui-nested-xl",
    "2xl": "w-cui-nested-2xl",
  },
  height: {
    "2xs": "h-cui-nested-2xs",
    xs: "h-cui-nested-xs",
    sm: "h-cui-nested-sm",
    md: "h-cui-nested-md",
    lg: "h-cui-nested-lg",
    xl: "h-cui-nested-xl",
    "2xl": "h-cui-nested-2xl",
  },
  "min-width": {
    "2xs": "min-w-cui-nested-2xs",
    xs: "min-w-cui-nested-xs",
    sm: "min-w-cui-nested-sm",
    md: "min-w-cui-nested-md",
    lg: "min-w-cui-nested-lg",
    xl: "min-w-cui-nested-xl",
    "2xl": "min-w-cui-nested-2xl",
  },
  "min-height": {
    "2xs": "min-h-cui-nested-2xs",
    xs: "min-h-cui-nested-xs",
    sm: "min-h-cui-nested-sm",
    md: "min-h-cui-nested-md",
    lg: "min-h-cui-nested-lg",
    xl: "min-h-cui-nested-xl",
    "2xl": "min-h-cui-nested-2xl",
  },
};

export function rootSizeClasses(size: UiSize = "sm", property: SizeClassProperty): string {
  return rootClasses[property][size];
}

export function nestedSizeClasses(size: UiSize = "sm", property: SizeClassProperty): string {
  return nestedClasses[property][size];
}
