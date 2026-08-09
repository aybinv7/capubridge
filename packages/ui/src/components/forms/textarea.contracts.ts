import type { Component } from "vue";

import type { UiAccent } from "../../foundations/contracts.ts";
import type { FieldSize } from "./form.contracts.ts";

export interface TextareaProps {
  accent?: UiAccent;
  /** Polymorphic wrapper element. Defaults to `'div'`. */
  as?: string | Component;
  /** Accent color token. Drives the focus ring and `infoMessage` colors. Default: theme accent. */
  color?: UiAccent;
  /** Extra classes for the inner content row. */
  contentClassName?: string;
  /** Visually dim the textarea and remove `contenteditable`. Default `false`. */
  disabled?: boolean;
  /** Floating error label. Always visible when `valid === false`. */
  errorMessage?: string;
  /** Extra classes for the icon wrapper. */
  iconClassName?: string;
  /** Floating label shown above the editor on focus. */
  infoMessage?: string;
  /** Extra classes for the editable `[contenteditable]` `<div>`. */
  inputClassName?: string;
  /** Maximum number of characters the user can type or paste. */
  maxLength?: number;
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
  /** Extra classes for the placeholder layer. */
  placeholderClassName?: string;
  /** Make the textarea non-editable but still selectable. Default `false`. */
  readOnly?: boolean;
  /** Apply pill-style corners. Default `false`. */
  rounded?: boolean;
  /** Textarea size token. Default `'lg'`. */
  size?: FieldSize;
  /** Render the focus ring flush against the element. Default `false`. */
  tightFocusRing?: boolean;
  /** Sync the editable `innerText` whenever the model changes from the outside. Default `true`. */
  updateContentOnChange?: boolean;
  /** Validity state. Default `true`. */
  valid?: boolean;
}

export type TextareaDefaultProps = Partial<Omit<TextareaProps, "as">>;

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
