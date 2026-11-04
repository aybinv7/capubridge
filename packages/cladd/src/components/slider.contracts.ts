import type { Color } from '../types.ts';
import type {
  ChoiceSize,
  SliderScale,
  SliderVariant,
} from './form.contracts.ts';

/** Slider size token, spelled out as upstream declares it. */
export type SliderSize = 'xs' | 'sm' | 'md';

export interface SliderProps {
  /** Accent color for the active track segment and thumb. Default: theme accent for `variant="thumb"`. */
  color?: Color;
  /** Debounce onChange calls in ms. Default `0` (immediate). */
  debounce?: number;
  /** Initial value (uncontrolled). Default `0`. Ignored when `value` is provided. */
  defaultValue?: number;
  /** Visually dim the slider and disable interaction. Default `false`. */
  disabled?: boolean;
  /** Reserved — currently unused in the rendered output. */
  input?: boolean;
  /** Default `100`. */
  max?: number;
  /** Default `0`. */
  min?: number;
  /** Native `name` - used for form submission and to group radio-like checkboxes. */
  name?: string;
  /** Render the active range as a bold filled accent instead of the subtle raised surface. Default `false`. */
  rangeFill?: boolean;
  /** Outline ring on the active range surface. Default `true`. */
  rangeOutline?: boolean;
  /** Block dragging without the disabled visual treatment. */
  readOnly?: boolean;
  /** Fully round the track corners. Only affects `variant="track"`. Default `false`. */
  rounded?: boolean;
  /** Value-to-position mapping. Default `'linear'`. */
  scale?: SliderScale;
  /** Slider size token. Default `'sm'`. */
  size?: ChoiceSize;
  /** Step size for the emitted value. Default `1`. */
  step?: number;
  /** Throttle onChange calls in ms. Default `0` (immediate). */
  throttle?: number;
  /** Outline ring on the thumb surface. Default `true`. */
  thumbOutline?: boolean;
  /** Render the focus ring flush against the slider. Default `false`. */
  tightFocusRing?: boolean;
  /** Controlled value. When omitted, falls back to uncontrolled mode using `defaultValue`. */
  value?: number;
  /** Visual presentation. Default `'thumb'`. */
  variant?: SliderVariant;
}

export type SliderDefaultProps = Partial<
  Omit<SliderProps, 'value' | 'defaultValue'>
>;

export const sliderRootHeights: Record<ChoiceSize, string> = {
  xs: 'h-cladd-thumb-xs',
  sm: 'h-cladd-thumb-sm',
  md: 'h-cladd-thumb-md',
};

export const sliderThumbSizes: Record<ChoiceSize, string> = {
  xs: 'size-cladd-thumb-xs',
  sm: 'size-cladd-thumb-sm',
  md: 'size-cladd-thumb-md',
};

export const sliderTrackBarClasses: Record<ChoiceSize, string> = {
  xs: '-mt-0.75 h-1.5',
  sm: '-mt-0.75 h-1.5',
  md: '-mt-1 h-2',
};

export const sliderRangeInsets: Record<ChoiceSize, string> = {
  xs: 'right-px left-px',
  sm: 'right-px left-px',
  md: 'right-0.75 left-0.75',
};

export const sliderValueOffsets: Record<ChoiceSize, string> = {
  xs: 'left-2',
  sm: 'left-2.5',
  md: 'left-3',
};

export const sliderThumbSpacingVars: Record<ChoiceSize, string> = {
  xs: 'var(--spacing-cladd-thumb-xs)',
  sm: 'var(--spacing-cladd-thumb-sm)',
  md: 'var(--spacing-cladd-thumb-md)',
};
