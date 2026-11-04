import type { Component, VNodeChild } from 'vue';

import type { UiSize } from '../foundations/contracts.ts';
import type { Color } from '../types.ts';
import type { FieldSize } from './form.contracts.ts';

/** Input size token, spelled out as upstream declares it. */
export type InputSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface InputProps {
  /** Polymorphic wrapper element. Defaults to `'div'`. */
  as?: string | Component;
  /** Native `autoFocus` — focus the input on mount. Default `false`. */
  autoFocus?: boolean;
  /** Render a clear (X) button on the right. Hidden when the value is empty. Default `false`. */
  clearButton?: boolean;
  /** Accessible label for the clear button. Default `'Clear'`. */
  clearLabel?: string;
  /** Accent color token. Drives the focus ring and `infoMessage` colors. Default: theme accent. */
  color?: Color;
  /** Extra classes for the inner `SurfaceCut` content area. */
  contentClassName?: string;
  /** Visually dim the input and disable interaction. Default `false`. */
  disabled?: boolean;
  /** Floating error label. Always visible when `valid === false`. Upstream `ReactNode` → `string | VNodeChild` + `info`/`error` slots. */
  errorMessage?: string | VNodeChild;
  /** Extra classes for the icon wrapper. */
  iconClassName?: string;
  /** Floating label shown above the input on focus. Upstream `ReactNode` → `string | VNodeChild` + `info`/`error` slots. */
  infoMessage?: string | VNodeChild;
  /** Extra classes for the actual `<input>` element. */
  inputClassName?: string;
  /** `id` for the inner `<input>`. */
  inputId?: string;
  /** Polymorphic inner control. Defaults to `'input'`. */
  inputComponent?: string | Component;
  /** Extra props spread onto the inner `<input>`. Upstream's `inputComponentProps`. */
  inputProps?: Record<string, unknown>;
  /** Native `inputMode` hint. */
  inputMode?:
    | 'decimal'
    | 'email'
    | 'none'
    | 'numeric'
    | 'search'
    | 'tel'
    | 'text'
    | 'url';
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
  /** Inherited from `SurfaceCutProps` via `InputProps & Omit<SurfaceCutOwnProps, ...>` — extra classes for the background layer. */
  bgClassName?: string;
  /** Inherited from `SurfaceCutProps` — show inset outline ring. Default `true`. */
  outline?: boolean;
  /** Inherited from `SurfaceCutProps` — enable hover overlay. */
  hoverable?: boolean;
  /** Inherited from `SurfaceCutProps` — enable pressed overlay. */
  clickable?: boolean;
  /** Inherited from `SurfaceCutProps` — force pressed. */
  pressed?: boolean;
  /** Inherited from `SurfaceCutProps` — overlay stack position. Default `'above'`. */
  overlayPosition?: 'above' | 'below';
  /** Inherited from `SurfaceCutProps` — extra classes for overlay. */
  overlayClassName?: string;
  /** Inherited from `SurfaceCutProps` — wrap children in SurfaceCutContent. Default `true` (Input forces `false`). */
  wrapContent?: boolean;
}

export type InputDefaultProps = Partial<Omit<InputProps, 'as'>>;

export const inputFontSizes: Record<FieldSize, string> = {
  sm: 'text-cladd-xs',
  md: 'text-cladd-xs',
  lg: 'text-cladd-xs',
  xl: 'text-cladd-xs',
  '2xl': 'text-cladd-xs',
};

export const inputIconWrapClasses: Record<FieldSize, string> = {
  sm: 'left-2.5 [&>svg]:size-4',
  md: 'left-2.5 [&>svg]:size-4',
  lg: 'left-2.5 [&>svg]:size-4',
  xl: 'left-2.5 [&>svg]:size-4',
  '2xl': 'left-3.5 [&>svg]:size-4',
};

export const inputPaddingNoIcon: Record<FieldSize, string> = {
  sm: 'px-2.5',
  md: 'px-2.5',
  lg: 'px-2.5',
  xl: 'px-2.5',
  '2xl': 'px-3.5',
};

export const inputPaddingWithIcon: Record<FieldSize, string> = {
  sm: 'pl-8.5 pr-2',
  md: 'pl-8.5 pr-2',
  lg: 'pl-8.5 pr-3',
  xl: 'pl-8.5 pr-3',
  '2xl': 'pl-9.5 pr-4',
};

export const inputClearButtonSizes: Record<FieldSize, UiSize> = {
  sm: '2xs',
  md: 'xs',
  lg: 'sm',
  xl: 'md',
  '2xl': 'lg',
};

export const inputClearGlyphSizes: Record<FieldSize, string> = {
  sm: 'size-3!',
  md: 'size-3.5!',
  lg: 'size-4',
  xl: 'size-4',
  '2xl': 'size-4',
};
