import type { Component } from 'vue';

import type { Color } from '../types.ts';

/** Logical placement of the addon relative to the control. */
export type InputGroupAddonSide = 'inline-start' | 'inline-end';

export interface InputGroupProps {
  /** Polymorphic root element. Defaults to `'div'`. */
  as?: string | Component;
  /** Disable the group and its wrapped control. Default `false`. */
  disabled?: boolean;
}

export type InputGroupDefaultProps = Partial<Omit<InputGroupProps, 'as'>>;

export interface InputGroupAddonProps {
  /** Polymorphic root element. Defaults to `'span'`. */
  as?: string | Component;
  /** Hide decorative content from assistive technology. Default `true`. */
  decorative?: boolean;
  /** Allow pointer interaction with the addon content. Default `false`. */
  interactive?: boolean;
  /** Logical placement of the addon. Default `'inline-start'`. */
  side?: InputGroupAddonSide;
}

export type InputGroupAddonDefaultProps = Partial<
  Omit<InputGroupAddonProps, 'as'>
>;

export interface InputGroupButtonProps {
  /** Polymorphic root element. Defaults to the package `Button`. */
  as?: string | Component;
  /** Accent color token for the button. */
  color?: Color;
  /** Disable the button. Default `false`. */
  disabled?: boolean;
  /** Accessible label for the button. */
  label?: string;
  /** Button size token. Default `'xs'`. */
  size?: 'xs' | 'sm';
  /** Button surface variant. Default `'solid'`. */
  variant?: 'gradient' | 'solid' | 'transparent';
}

export type InputGroupButtonDefaultProps = Partial<
  Omit<InputGroupButtonProps, 'as'>
>;

export interface InputGroupInputProps {
  /** Disable the control. Default `false`. */
  disabled?: boolean;
  /** Explicit control ID. Defaults to the field, then group, control ID. */
  inputId?: string;
  /** Native `name` attribute. */
  name?: string;
  /** Native `placeholder`. */
  placeholder?: string;
  /** Make the control non-editable but still focusable. Default `false`. */
  readOnly?: boolean;
  /** Native `required` attribute. Default `false`. */
  required?: boolean;
  /** Native `<input type>`. Default `'text'`. */
  type?: string;
  /** Validity state. Default `true`. */
  valid?: boolean;
}

export type InputGroupInputDefaultProps = Partial<InputGroupInputProps>;

export interface InputGroupTextareaProps {
  /** Disable the control. Default `false`. */
  disabled?: boolean;
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
  /** Make the editor non-editable but still selectable. Default `false`. */
  readOnly?: boolean;
  /** Validity state. Default `true`. */
  valid?: boolean;
}

export type InputGroupTextareaDefaultProps = Partial<InputGroupTextareaProps>;
