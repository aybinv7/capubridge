import type {
  SurfaceLevelInput,
  SurfaceVariant,
} from '../foundations/contracts.ts';
import type { Color } from '../types.ts';

export type NumberScrubberSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface NumberScrubberProps {
  /** Value advanced per pixel of drag while `Shift` is held. Default `step` (1 pixel per step - coarser scrubbing). Set lower than `dragStep` to invert the gesture. */
  altDragStep?: number;
  /** Accent color token. Sets `cladd-color-{name}` on the trigger - drives text and ring colors. */
  color?: Color;
  /** Extra classes for the inner content row of the trigger. */
  contentClassName?: string;
  /** Visually dim and disable all interactions (drag and edit). */
  disabled?: boolean;
  /** Format the displayed value, e.g. `(v) => `${v} px``. Defaults to plain stringification. */
  displayValue?: (value: number) => string;
  /** Value advanced per pixel of drag. Default `step / 5` (5 pixels per step - finer scrubbing). */
  dragStep?: number;
  /** Extra classes for the icon wrapper. */
  iconClassName?: string;
  /** Extra classes for the inner Input's input element. */
  inputClassName?: string;
  /** Maximum allowed value. Default `1_000_000`. */
  max?: number;
  /** Minimum allowed value. Default `0`. */
  min?: number;
  /** Render the surface outline ring on the idle Button. Defaults to `true`. */
  outline?: boolean;
  /** Block drag and edit while keeping the trigger visually enabled. */
  readOnly?: boolean;
  /** When `true`, applies fully rounded corners (`rounded-full`). Default size-specific radii are used when `false`. */
  rounded?: boolean;
  /** Show the chevron-expand indicator on the left of the trigger. Default `true`. */
  scrubberIcon?: boolean;
  /** Trigger size - drives heights, paddings, font, and the inner Input/Button size. Default `'md'`. */
  size?: NumberScrubberSize;
  /** Increment used both for the keyboard input and to round drag deltas. Default `1`. */
  step?: number;
  /** Forwarded to the underlying `Surface` as `level` - see `SurfaceProps.level` for the relative-offset (`"+1"`/`"-1"`) syntax. */
  surfaceLevel?: SurfaceLevelInput;
  /** Underlying `Surface` variant used by the idle Button - see `SurfaceVariant`. Defaults to `'gradient'`. */
  variant?: SurfaceVariant;
}

/** Shape of `NumberScrubber` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type NumberScrubberDefaultProps = Partial<NumberScrubberProps>;

/** Clicks fired within this window of a drag ending are swallowed. */
export const numberScrubberClickSuppressMs = 200;
