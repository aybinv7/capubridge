import type { Component } from 'vue';

import type { Color } from '../types.ts';
import type { ChoiceSize } from './form.contracts.ts';

/** Checkbox size token, spelled out as upstream declares it. */
export type CheckboxSize = 'xs' | 'sm' | 'md';

export interface CheckboxProps {
  /** Polymorphic root element. Defaults to `'label'`. */
  as?: string | Component;
  /** Extra classes for the inner check icon. */
  checkClassName?: string;
  /** Controlled checked state. Default `false`. */
  checked?: boolean;
  /** Accent color for the checked state. Default: theme accent. */
  color?: Color;
  /** Visually dim the checkbox and disable interaction. Default `false`. */
  disabled?: boolean;
  /** Auto-computed when omitted: `true` if `as === 'label'` OR `input` is `true`. */
  focusable?: boolean;
  /** Auto-computed when omitted: `true` if `as === 'label'`. */
  hoverable?: boolean;
  /** Native `id`. Used as the hidden input's `id` when `inputId` is not set. */
  id?: string;
  /** Render a hidden native `<input type="checkbox">`. Default `true`. */
  input?: boolean;
  /** `id` for the hidden `<input>`. */
  inputId?: string;
  /** Native `name` — used for form submission. */
  name?: string;
  /** Block toggling without the disabled visual treatment. */
  readOnly?: boolean;
  /** Native `required` — forwarded to the hidden `<input>`. */
  required?: boolean;
  /** Checkbox size token. Default `'sm'`. */
  size?: ChoiceSize;
  /** Outline ring on the thumb surfaces. Default `true`. */
  thumbOutline?: boolean;
  /** Native `value` — submitted with the form when `checked`. */
  value?: string;
}

export type CheckboxDefaultProps = Partial<Omit<CheckboxProps, 'as'>>;

export const checkboxRootSizes: Record<ChoiceSize, string> = {
  xs: 'size-cladd-thumb-xs p-0',
  sm: 'size-cladd-thumb-sm p-1',
  md: 'size-cladd-thumb-md p-1',
};

export const checkboxIndicatorSizes: Record<ChoiceSize, string> = {
  xs: 'size-2.5',
  sm: 'size-3',
  md: 'size-4',
};
