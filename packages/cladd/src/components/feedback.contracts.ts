import type { Component, VNodeChild } from 'vue';

import type {
  SurfaceLevelInput,
  SurfaceVariant,
  UiSize,
} from '../foundations/contracts.ts';
import type { Color } from '../types.ts';

/** Spinner size token, spelled out as upstream declares it. */
export type SpinnerSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface SpinnerProps {
  /** Accent color for the spinning ring. Default: theme accent. */
  color?: Color;
  /** Spinner dimension. Default `'sm'`. */
  size?: UiSize;
}

export type SpinnerDefaultProps = Partial<SpinnerProps>;

export interface FocusRingProps {
  /** Accent color token. Sets the button's `cladd-color-{name}` class - drives text and ring colors. */
  color?: Color;
  /** Show the ring regardless of focus state. Default `false`. */
  force?: boolean;
  /** Peer group name the ring watches for focus. Default `'input'`. */
  group?: string;
  /** Offset the ring outward from the focused element. Default `true`. */
  offset?: boolean;
}

export type FocusRingDefaultProps = Partial<
  Omit<FocusRingProps, 'force' | 'group'>
>;

export interface ToastProps {
  /** Render the auto close button on the right. Default `true`. */
  closeButton?: boolean;
  /** Default `'neutral'`. */
  color?: Color;
  /** Icon component rendered before the text content. Receives `iconProps`. */
  icon?: Component;
  /** Props forwarded to the `icon` component. */
  iconProps?: Record<string, unknown>;
  /** Outline ring on the toast surface. Default `true`. */
  outline?: boolean;
  /** Portal target selector. Default `'#app, #__next, #root'`. */
  root?: string | HTMLElement;
  /** Stop click propagation on the toast surface. */
  stopPropagationOnClick?: boolean;
  /** Default depends on theme: `3` for dark, `1` for light. */
  surfaceLevel?: SurfaceLevelInput;
  /** Body text slot. Rendered as a smaller line under `title`. Upstream `ReactNode` → `string | VNodeChild` + `text` slot. */
  text?: string | VNodeChild;
  /** Auto-close after this many ms. Pass `0` to disable auto-close. Default `5000`. */
  timeout?: number;
  /** Title slot. Rendered as a bold line above `text`. Upstream `string | ReactNode` → `string | VNodeChild` + `title` slot. */
  title?: string | VNodeChild;
  /** Surface variant. Default `'gradient'`. */
  variant?: SurfaceVariant;
}

export type ToastDefaultProps = Partial<
  Omit<ToastProps, 'icon' | 'iconProps' | 'text' | 'title'>
>;
