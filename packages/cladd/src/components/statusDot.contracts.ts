import type { Color } from '../types.ts';

export type StatusDotSize = 'xs' | 'sm' | 'md';

export type StatusDotVariant = 'solid' | 'hollow';

export interface StatusDotProps {
  /** Accent color token. Omit for the quiet neutral mark (`fg-softer`). */
  color?: Color;
  /** Accessible name. Without it the dot is decorative and hidden from assistive tech. */
  label?: string;
  /** Breathe while a state is in progress. Collapses under reduced motion. Default `false`. */
  pulse?: boolean;
  /** `xs` 5px, `sm` 6px, `md` 8px. Default `'sm'`. */
  size?: StatusDotSize;
  /** `solid` fills the dot; `hollow` draws a 1px ring for an absent or unknown state. Default `'solid'`. */
  variant?: StatusDotVariant;
}

export type StatusDotDefaultProps = Partial<Omit<StatusDotProps, 'label'>>;

export const statusDotSizeClasses: Record<StatusDotSize, string> = {
  xs: 'size-1.25',
  sm: 'size-1.5',
  md: 'size-2',
};
