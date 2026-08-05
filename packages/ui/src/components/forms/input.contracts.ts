import type { UiSize } from "../../foundations/contracts.ts";
import type { FieldSize } from "./form.contracts.ts";

export const inputFontSizes: Record<FieldSize, string> = {
  sm: "text-cui-xs",
  md: "text-cui-xs",
  lg: "text-cui-xs",
  xl: "text-cui-xs",
  "2xl": "text-cui-xs",
};

export const inputIconWrapClasses: Record<FieldSize, string> = {
  sm: "left-2.5 [&>svg]:size-4",
  md: "left-2.5 [&>svg]:size-4",
  lg: "left-2.5 [&>svg]:size-4",
  xl: "left-2.5 [&>svg]:size-4",
  "2xl": "left-3.5 [&>svg]:size-4",
};

export const inputPaddingNoIcon: Record<FieldSize, string> = {
  sm: "px-2.5",
  md: "px-2.5",
  lg: "px-2.5",
  xl: "px-2.5",
  "2xl": "px-3.5",
};

export const inputPaddingWithIcon: Record<FieldSize, string> = {
  sm: "pl-8.5 pr-2",
  md: "pl-8.5 pr-2",
  lg: "pl-8.5 pr-3",
  xl: "pl-8.5 pr-3",
  "2xl": "pl-9.5 pr-4",
};

export const inputClearButtonSizes: Record<FieldSize, UiSize> = {
  sm: "2xs",
  md: "xs",
  lg: "sm",
  xl: "md",
  "2xl": "lg",
};

export const inputClearGlyphSizes: Record<FieldSize, string> = {
  sm: "size-3!",
  md: "size-3.5!",
  lg: "size-4",
  xl: "size-4",
  "2xl": "size-4",
};
