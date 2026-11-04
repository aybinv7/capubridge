import type { Component } from 'vue';

import type { Color } from '../types.ts';

export interface LinkProps {
  /**
   * Polymorphic element. When omitted, defaults to `'a'` if `href` is provided, otherwise `'button'`. Pass an explicit value to override (e.g. a router `Link` component).
   */
  as?: string | Component;
  /** Accent color token */
  color?: Color;
  /** Native `disabled` attribute. */
  disabled?: boolean;
  /** Renders a `FocusableLayer` ring on keyboard focus. Defaults to `true`. */
  focusable?: boolean;
  /** Native `href` - when provided, the polymorphic default switches from `'button'` to `'a'`. */
  href?: string;
  /** Native `readOnly` attribute. */
  readOnly?: boolean;
}

/** Shape of `Link` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type LinkDefaultProps = Partial<Omit<LinkProps, 'as'>>;
