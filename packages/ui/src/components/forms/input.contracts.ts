import type { Component } from "vue";

import type { UiAccent, UiSize } from "../../foundations/contracts.ts";
import type { FieldSize } from "./form.contracts.ts";

export interface InputProps {
  accent?: UiAccent;
  /** Polymorphic wrapper element. Defaults to `'div'`. */
  as?: string | Component;
  /** Native `autoFocus` — focus the input on mount. Default `false`. */
  autofocus?: boolean;
  /** Render a clear (X) button on the right. Hidden when the value is empty. Default `false`. */
  clearButton?: boolean;
  /** Accessible label for the clear button. Default `'Clear'`. */
  clearLabel?: string;
  /** Accent color token. Drives the focus ring and `infoMessage` colors. Default: theme accent. */
  color?: UiAccent;
  /** Extra classes for the inner `SurfaceCut` content area. */
  contentClassName?: string;
  /** Visually dim the input and disable interaction. Default `false`. */
  disabled?: boolean;
  /** Floating error label. Always visible when `valid === false`. */
  errorMessage?: string;
  /** Extra classes for the icon wrapper. */
  iconClassName?: string;
  /** Floating label shown above the input on focus. */
  infoMessage?: string;
  /** Extra classes for the actual `<input>` element. */
  inputClassName?: string;
  /** `id` for the inner `<input>`. */
  inputId?: string;
  /** Native `inputMode` hint. */
  inputMode?: "decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url";
  /** Native `max` attribute. */
  max?: number | string;
  /** Native `maxLength` attribute. */
  maxLength?: number;
  /** Native `min` attribute. */
  min?: number | string;
  /** Native `name` attribute. */
  name?: string;
  /** Native `pattern` attribute. */
  pattern?: string;
  /** Native `placeholder`. */
  placeholder?: string;
  /** Make the input non-editable but still focusable. Default `false`. */
  readOnly?: boolean;
  /** Native `required` attribute. Default `false`. */
  required?: boolean;
  /** Apply pill corners. Default `false`. */
  rounded?: boolean;
  /** Input size token. Default `'lg'`. */
  size?: FieldSize;
  /** Native `step` attribute. */
  step?: number | string;
  /** Render the focus ring flush against the element. Default `false`. */
  tightFocusRing?: boolean;
  /** Native `<input type>`. Default `'text'`. */
  type?: string;
  /** Validity state. Default `true`. */
  valid?: boolean;
}

export type InputDefaultProps = Partial<Omit<InputProps, "as">>;

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
