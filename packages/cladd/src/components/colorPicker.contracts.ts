import type {
  SurfaceLevelInput,
  SurfaceVariant,
  UiSize,
} from '../foundations/contracts.ts';
import type {
  ColorEditorValue,
  ColorInput,
  ColorValue,
  GradientInput,
} from '../shared/color.ts';
import type { Color } from '../types.ts';
import type { ButtonSurface } from './button.contracts.ts';
import type {
  ColorEditorControlSize,
  ColorEditorFormat,
} from './colorEditor.contracts.ts';
import type { PopoverOffset, PopoverPosition } from './overlay.contracts.ts';

/** Swatch box size per field size — kept in step with the icon slot. */
export const colorPickerSwatchSizes: Record<UiSize, string> = {
  '2xs': 'size-3',
  xs: 'size-3',
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-4',
  xl: 'size-4',
  '2xl': 'size-5',
};

export type ColorPickerStoredValue =
  | ColorEditorValue
  | ColorInput
  | ColorValue
  | GradientInput
  | undefined;

export type ColorPickerDisplay =
  | { background: string; empty: false; text: string }
  | { empty: true };

export interface ColorPickerProps {
  /** Show the alpha slider and scrubber. Default `true`. */
  alpha?: boolean;
  /** Gradient angle control: a 45°-step button, or a degree scrubber. Default `'scrubber'`. */
  angleControl?: 'button' | 'scrubber';
  /**
   * External anchor element. When provided the trigger button is **not rendered** - the caller owns the trigger and `popoverOpen` wiring.
   */
  anchorElement?: HTMLElement;
  /** Alias for `anchorElement` — mirrors upstream `anchorRef` (React `RefObject`). */
  anchorRef?: HTMLElement;
  /** Extra classes for the editor's saturation/brightness area. */
  areaClassName?: string;
  /** Accent color for the trigger button. Forwarded to `Button.color`. */
  color?: Color;
  /** Extra classes for the trigger button's inner content row. */
  contentClassName?: string;
  /** Render the surface outline on the editor's inner controls. Default `true`. */
  controlOutline?: boolean;
  /** Size of the editor's inner controls. Default `'md'`. */
  controlSize?: ColorEditorControlSize;
  /** Debounce `change` calls in ms. Forwarded to the editor. */
  debounce?: number;
  /** Initial value (uncontrolled). */
  defaultValue?: ColorInput | GradientInput;
  /** Visually dim the trigger and prevent the popover from opening. */
  disabled?: boolean;
  /** Show the chevron-down indicator on the right of the trigger. Default `true`. */
  dropdownIcon?: boolean;
  /** Extra classes for the editor panel root. */
  editorClassName?: string;
  /** Which channels the scrubber row shows. Default `'rgb'`. */
  format?: ColorEditorFormat;
  /** Enable the Solid/Gradient switch and gradient editing. Default `false`. */
  gradient?: boolean;
  /** Label rendered for a gradient value in the trigger. Default `'Gradient'`. */
  gradientLabel?: string;
  /** Show the hex input. Default `true`. */
  hexInput?: boolean;
  /** Extra classes for the icon wrapper. */
  iconClassName?: string;
  /** Show the channel-scrubber row. Default `true`. */
  inputs?: boolean;
  /** Forwarded to the trigger `Button` — allows wrapping the value across lines. */
  multiline?: boolean;
  /** Render the trigger button's surface outline ring. Forwarded to `Button.outline`. */
  outline?: boolean;
  /** Value shown when there is no color (or a fully transparent one) and no default slot. */
  placeholder?: string;
  /** Extra classes applied to the value container when showing the placeholder. */
  placeholderClassName?: string;
  /** Extra classes for the popover. Default `'w-64 p-3'`. */
  popoverClassName?: string;
  /** Accent color for the popover. Forwarded to `Popover.color`. */
  popoverColor?: Color;
  /** Default `['-50%', 4]`. */
  popoverOffset?: PopoverOffset;
  /** Default `'bottom-end'`. */
  popoverPosition?: PopoverPosition;
  /** Surface level for the popover. Default same as `Popover`'s `surfaceLevel`. */
  popoverSurfaceLevel?: SurfaceLevelInput;
  /** Controlled popover open state. Pair with popover change events. */
  popoverState?: boolean;
  /** Show the trigger with the current value but block opening the popover. */
  readOnly?: boolean;
  /** Reverse the visual order of the content row (icon/swatch/value ↔ dropdown). */
  reverse?: boolean;
  /** Pill-style trigger button. Forwarded to `Button.rounded`. */
  rounded?: boolean;
  /** Trigger button size — also scales the swatch. Forwarded to `Button.size`. */
  size?: UiSize;
  /** Trigger button surface: `'surface'` (default) or `'cut'` (inset/recessed). */
  surface?: ButtonSurface;
  /** Extra classes for the color swatch. */
  swatchClassName?: string;
  /** Preset colors rendered as a row of thumbs in the editor. */
  swatches?: ColorInput[];
  /** Throttle `change` calls in ms. Forwarded to the editor. */
  throttle?: number;
  /** Extra classes for the value display inside the trigger. */
  valueClassName?: string;
  /** Inherited from `ButtonProps` via `ColorPickerProps & Omit<ButtonProps, ...>` — polymorphic root element. */
  as?: string;
  /** Inherited from `ButtonProps` — enables active/pressed visual states. Default `true`. */
  clickable?: boolean;
  /** Inherited from `ButtonProps` — whether trigger can receive focus. Default `true`. */
  focusable?: boolean;
  /** Inherited from `ButtonProps` — show spinner overlay and fade content. */
  loading?: boolean;
  /** Inherited from `ButtonProps` — icon-only square button. */
  square?: boolean;
  /** Inherited from `ButtonProps` — forwarded to trigger `Surface` as `level`. */
  surfaceLevel?: SurfaceLevelInput;
  /** Inherited from `ButtonProps` — enable hover overlay. Default `true`. */
  hoverable?: boolean;
  /** Inherited from `ButtonProps` — force pressed visual state. */
  pressed?: boolean;
  /** Inherited from `ButtonProps` — surface variant for the trigger. Default `'gradient'`. */
  variant?: SurfaceVariant;
  /** Inherited from `ButtonProps` — render focus ring flush inside. Default `false`. */
  tightFocusRing?: boolean;
}

/** Shape of `ColorPicker` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type ColorPickerDefaultProps = Partial<ColorPickerProps>;
