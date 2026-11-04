import type { Component } from 'vue';

import type { SurfaceVariant, UiSize } from '../foundations/contracts.ts';
import type { Color } from '../types.ts';

export interface SegmentedProps {
  /** Polymorphic root element. Defaults to `'div'`. */
  as?: string | Component;
  /** Color applied to the **active** segment button. Defaults to the enclosing surface color, then theme accent. */
  activeColor?: Color;
  /** Outline ring on the **active** segment button. Default `true`. */
  activeOutline?: boolean;
  /** Surface variant applied to the **active** segment button. Default `'gradient'`. */
  activeVariant?: SurfaceVariant;
  /** Accent color applied to **inactive** segment buttons. */
  color?: Color;
  /** Visually dim the entire group and disable pointer events. Default `false`. */
  disabled?: boolean;
  /** Outline ring on **inactive** segment buttons. Default `false`. */
  outline?: boolean;
  /** Pill-style segment buttons. Default `true`, forwarded via context. */
  rounded?: boolean;
  /** Segment button size. Default `'md'`, forwarded via context. */
  size?: UiSize;
  /** Surface variant applied to **inactive** segment buttons through context. Default `'transparent'`. */
  variant?: SurfaceVariant;
}

export type SegmentedDefaultProps = Partial<Omit<SegmentedProps, 'as'>>;

export interface SegmentedButtonProps {
  /**
   * Marks this button as the selected segment. Switches to the active color/variant/outline,
   * raises `surfaceLevel` by `+2`, and sets `readOnly` so an already-selected segment can't be
   * pressed again.
   */
  active?: boolean;
}

export type SegmentedButtonDefaultProps = Partial<
  Omit<SegmentedButtonProps, 'active'>
>;
