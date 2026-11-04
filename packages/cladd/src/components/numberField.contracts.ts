import type {
  SurfaceLevelInput,
  SurfaceVariant,
} from '../foundations/contracts.ts';
import type { Color } from '../types.ts';

export type NumberFieldSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface NumberFieldProps {
  /** Outline ring on the +/− buttons. Default `false`. */
  buttonOutline?: boolean;
  /** Surface variant applied to the +/− buttons. Default `'transparent'`. */
  buttonVariant?: SurfaceVariant;
  /** Accent color token. Sets the container's `cladd-color-{name}` class - cascades to the +/− buttons. */
  color?: Color;
  /** Extra classes for the inner `SurfaceContent` wrapper (where the −/value/+ row is laid out). */
  contentClassName?: string;
  /** Visually dim the number field and disable both buttons. */
  disabled?: boolean;
  /**
   * When `true` (default), the value is rendered in an editable `Input`.
   *
   * When `false`, the value is rendered in a read-only `SurfaceCut` chip - useful when keyboard entry is not desired.
   */
  input?: boolean;
  /** Extra classes for the value `Input` (or `SurfaceCut`). */
  inputClassName?: string;
  /** Default `1_000_000`. */
  max?: number;
  /** Default `0`. */
  min?: number;
  /** Outline ring on the number field **container**. Default `true`. */
  outline?: boolean;
  /** Block changes without the disabled visual treatment. */
  readOnly?: boolean;
  /** Pill-shape the container and the +/− buttons. Default `true`. */
  rounded?: boolean;
  /** Size token. Drives container/button height, padding, and font size. Default `'md'`. */
  size?: NumberFieldSize;
  /** Increment per +/− press. Default `1`. */
  step?: number;
  /** Forwarded to the underlying `Surface` as `level` - see `SurfaceProps.level`. */
  surfaceLevel?: SurfaceLevelInput;
  /** Pill-shape the value display. Default `false`. */
  valueRounded?: boolean;
  /** Surface variant for the number field **container**. Default `'gradient'`. */
  variant?: SurfaceVariant;
}

/** Shape of `NumberField` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type NumberFieldDefaultProps = Partial<NumberFieldProps>;

export const numberFieldPaddings: Record<NumberFieldSize, string> = {
  sm: 'px-2.5',
  md: 'px-2.5',
  lg: 'px-2.5',
  xl: 'px-2.5',
  '2xl': 'px-3.5',
};
