import type { Component } from "vue";

import type { UiAccent } from "../../foundations/contracts.ts";
import type { ChoiceSize } from "./form.contracts.ts";

export interface RadioProps {
  accent?: UiAccent;
  /** Polymorphic root element. Defaults to `'label'`. */
  as?: string | Component;
  /** Controlled checked state. Default `false`. */
  checked?: boolean;
  /** Accent color for the checked state. Default: theme accent. */
  color?: UiAccent;
  /** Visually dim the radio and disable interaction. Default `false`. */
  disabled?: boolean;
  /** Auto-computed when omitted: `true` if `as === 'label'` OR `input` is `true`. */
  focusable?: boolean;
  /** Auto-computed when omitted: `true` if `as === 'label'`. */
  hoverable?: boolean;
  id?: string;
  /** Render a hidden native input. Default `true`. */
  input?: boolean;
  /** `id` for the hidden `<input>`. */
  inputId?: string;
  /** Native `name` — used to group radios in the same set. */
  name?: string;
  /** Block toggling without the disabled visual treatment. */
  readOnly?: boolean;
  readonly?: boolean;
  /** Native `required` — forwarded to the hidden `<input>`. */
  required?: boolean;
  /** Radio size token. Default `'sm'`. */
  size?: ChoiceSize;
  /** Outline ring on the thumb surfaces. Default `true`. */
  thumbOutline?: boolean;
  /** Native `value` — submitted with the form when `checked`. */
  value?: string;
}

export type RadioDefaultProps = Partial<Omit<RadioProps, "as">>;

export interface RadioGroupProps {
  disabled?: boolean;
  loop?: boolean;
  name?: string;
  orientation?: "horizontal" | "vertical";
  required?: boolean;
}

export type RadioGroupDefaultProps = Partial<RadioGroupProps>;

export const radioRootSizes: Record<ChoiceSize, string> = {
  xs: "size-cui-thumb-xs p-0",
  sm: "size-cui-thumb-sm p-1",
  md: "size-cui-thumb-md p-1",
};

export const radioIndicatorSizes: Record<ChoiceSize, string> = {
  xs: "size-1.5",
  sm: "size-2",
  md: "size-2",
};
