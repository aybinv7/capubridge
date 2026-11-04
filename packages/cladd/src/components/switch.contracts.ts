import type { Component } from 'vue';

import type {
  SurfaceLevelInput,
  SurfaceVariant,
} from '../foundations/contracts.ts';
import type { Color } from '../types.ts';

/** Switch size token, spelled out as upstream declares it. */
export type SwitchSize = 'sm' | 'md';

export interface SwitchProps {
  /** Polymorphic root element. Defaults to `'label'`. */
  as?: string | Component;
  /** Controlled checked state. Default `false`. */
  checked?: boolean;
  /** Accent color for the checked state thumb fill. Default: theme accent. */
  color?: Color;
  /** Visually dim the switch and disable interaction. Default `false`. */
  disabled?: boolean;
  /** Auto-computed when omitted: `true` if `as === 'label'` OR `input` is `true`. */
  focusable?: boolean;
  /** Auto-computed when omitted: `true` if `as === 'label'`. */
  hoverable?: boolean;
  /** Native `id`. Used as the hidden input's `id` when `inputId` is not set. */
  id?: string;
  /** Render a hidden native input. Default `true`. */
  input?: boolean;
  /** `id` for the hidden `<input>`. */
  inputId?: string;
  /** Native `name` - used for form submission and to group radio-like checkboxes. */
  name?: string;
  /** Outline ring on the track. Default `true`. */
  outline?: boolean;
  /** Block toggling without the disabled visual treatment. */
  readOnly?: boolean;
  /** Native `required` - forwarded to the hidden `<input>` for form validation. */
  required?: boolean;
  /** Switch size token. Drives track width and thumb size. Default `'md'`. */
  size?: SwitchSize;
  /** Surface level for the track. Default `'+1'`. */
  surfaceLevel?: SurfaceLevelInput;
  /** Outline ring on the thumb. Default `true`. */
  thumbOutline?: boolean;
  /** Surface level for the thumb. Default `'+2'`. */
  thumbSurfaceLevel?: SurfaceLevelInput;
  /** Surface variant for the thumb. Default `'gradient'`. */
  thumbVariant?: SurfaceVariant;
  /** Identifies this item - matched against the accordion's open value(s). */
  value?: string;
  /** Surface variant for the track. Default `'solid'`. */
  variant?: SurfaceVariant;
}

export type SwitchDefaultProps = Partial<Omit<SwitchProps, 'as'>>;

export const switchRootSizes: Record<SwitchSize, string> = {
  sm: 'w-10 p-1',
  md: 'w-12 p-1',
};

export const switchThumbSizes: Record<SwitchSize, string> = {
  sm: 'size-cladd-thumb-xs',
  md: 'size-cladd-thumb-sm',
};

export const switchThumbOffsets: Record<SwitchSize, string> = {
  sm: 'translate-x-cladd-thumb-xs',
  md: 'translate-x-cladd-thumb-sm',
};
