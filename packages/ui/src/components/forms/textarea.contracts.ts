import type { FieldSize } from "./form.contracts.ts";

export const textareaFontSizes: Record<FieldSize, string> = {
  sm: "text-cui-xs",
  md: "text-cui-xs",
  lg: "text-cui-xs",
  xl: "text-cui-xs",
  "2xl": "text-cui-xs",
};

export const textareaIconWrapClasses: Record<FieldSize, string> = {
  sm: "left-2.5 [&>svg]:size-4 top-1",
  md: "left-2.5 [&>svg]:size-4 top-1.5",
  lg: "left-2.5 [&>svg]:size-4 top-2",
  xl: "left-2.5 [&>svg]:size-4 top-3",
  "2xl": "left-3.5 [&>svg]:size-4 top-4",
};

export const textareaPaddingNoIcon: Record<FieldSize, string> = {
  sm: "px-2.5",
  md: "px-2.5",
  lg: "px-2.5",
  xl: "px-2.5",
  "2xl": "px-3.5",
};

export const textareaPaddingVertical: Record<FieldSize, string> = {
  sm: "pt-1 pb-0.5",
  md: "pt-1.5 pb-1",
  lg: "pt-2 pb-1.5",
  xl: "pt-3 pb-2.5",
  "2xl": "pt-4 pb-3.5",
};

export const textareaPaddingWithIcon: Record<FieldSize, string> = {
  sm: "pl-8.5 pr-2",
  md: "pl-8.5 pr-2",
  lg: "pl-8.5 pr-3",
  xl: "pl-8.5 pr-3",
  "2xl": "pl-9.5 pr-4",
};
