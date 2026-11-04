import type { UiSize } from '../foundations/contracts.ts';
import type {
  ColorEditorValue,
  ColorInput,
  ColorValue,
  GradientInput,
  Hsva,
} from '../shared/color.ts';

/** Size token for the inner controls (scrubbers, hex input, gradient buttons). */
export type ColorEditorControlSize = '2xl' | 'lg' | 'md' | 'sm' | 'xl';

/** Which channel scrubbers the inputs row shows. Does not affect the emitted value. */
export type ColorEditorFormat = 'hsb' | 'hsl' | 'rgb';

export type ColorEditorMode = 'linear' | 'solid';

export interface ColorEditorProps {
  /** Show the alpha slider and the alpha scrubber. Default `true`. */
  alpha?: boolean;
  /** Angle control in gradient mode: a 45°-step button, or a degree scrubber. Default `'scrubber'`. */
  angleControl?: 'button' | 'scrubber';
  /** Extra classes for the saturation/brightness area (e.g. to set its height). */
  areaClassName?: string;
  /** Render the surface outline on the inner controls — channel/alpha scrubbers, hex input, and the Solid/Gradient toolbar.
   *
   *  The gradient bar's flip/angle controls stay ghost regardless. Default `true`.
   */
  controlOutline?: boolean;
  /** Size of the inner controls — scrubbers, hex input, gradient buttons. Default `'md'`.
   *
   * The Solid/Gradient toolbar is rendered one step smaller.
   */
  controlSize?: ColorEditorControlSize;
  /** Debounce `change` calls in ms. Fires once after changes stop for N ms. Defaults to `0` (immediate). */
  debounce?: number;
  /** Initial value (uncontrolled). */
  defaultValue?: ColorInput | GradientInput;
  /** Dim the panel and block interaction. */
  disabled?: boolean;
  /** Which channels the scrubber row shows. Default `'rgb'`. */
  format?: ColorEditorFormat;
  /** Enable the Solid/Gradient switch and gradient editing. Default `false`. */
  gradient?: boolean;
  /** Show the hex input. Default `true`. */
  hexInput?: boolean;
  /** Show the channel-scrubber row. Default `true`. */
  inputs?: boolean;
  /** Block interaction without the dimmed treatment. */
  readOnly?: boolean;
  /** Preset colors rendered as a row of thumbs. Clicking one applies it to the color (or the selected gradient stop).
   *
   * Solid colors only.
   */
  swatches?: ColorInput[];
  /** Throttle `change` calls in ms. Fires immediately, then at most once per N ms while changing, with a trailing call for the final value. Defaults to `0` (immediate).
   *
   * Takes precedence over `debounce`.
   */
  throttle?: number;
}

/** Shape of `ColorEditor` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type ColorEditorDefaultProps = Partial<ColorEditorProps>;

export type ColorEditorEmitValue = ColorEditorValue | ColorValue;

export interface ColorEditorStop {
  hsva: Hsva;
  position: number;
}

export interface ColorEditorInternal {
  active: 0 | 1;
  angle: number;
  mode: ColorEditorMode;
  solid: Hsva;
  stops: [ColorEditorStop, ColorEditorStop];
}

// Fixed dimensions — customize the area via `areaClassName`, the panel via `className`.
export const colorEditorAreaHeight = 'h-36';
export const colorEditorBarHeight = 'h-3';
export const colorEditorThumb = 'size-4';
export const colorEditorThumbPx = 16;
export const colorEditorSwatch = 'size-4';

/** The Solid/Gradient toolbar renders one step below `controlSize`. */
export const colorEditorToolbarSizes: Record<ColorEditorControlSize, UiSize> = {
  sm: 'xs',
  md: 'sm',
  lg: 'md',
  xl: 'lg',
  '2xl': 'xl',
};

export const colorEditorThumbClass =
  'absolute rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.2),0_1px_3px_rgba(0,0,0,0.45)] outline-none focus-visible:ring-2 focus-visible:ring-cladd-primary';

export const colorEditorHueTrack =
  'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)';
