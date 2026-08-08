import type { Component } from "vue";

import type {
  SurfaceLevelInput,
  SurfaceVariant,
  UiAccent,
  UiSize,
} from "../../foundations/contracts.ts";

export interface SpinnerProps {
  accent?: UiAccent;
  /** Accent color for the spinning ring. Default: theme accent. */
  color?: UiAccent;
  /** Spinner dimension. Default `'sm'`. */
  size?: UiSize;
}

export type SpinnerDefaultProps = Partial<SpinnerProps>;

export interface FocusRingProps {
  accent?: UiAccent;
  color?: UiAccent;
  /** Show the ring regardless of focus state. Default `false`. */
  force?: boolean;
  /** Peer group name the ring watches for focus. Default `'input'`. */
  group?: string;
  /** Offset the ring outward from the focused element. Default `true`. */
  offset?: boolean;
}

export type FocusRingDefaultProps = Partial<Omit<FocusRingProps, "force" | "group">>;

export interface ToastProps {
  /** Render the auto close button on the right. Default `true`. */
  closeButton?: boolean;
  /** Default `'neutral'`. */
  color?: UiAccent;
  /** Icon component rendered before the text content. Receives `iconProps`. */
  icon?: Component;
  iconProps?: Record<string, unknown>;
  /** Outline ring on the toast surface. Default `true`. */
  outline?: boolean;
  root?: string | HTMLElement;
  /** Stop click propagation on the toast surface. */
  stopPropagationOnClick?: boolean;
  /** Default depends on theme: `3` for dark, `1` for light. */
  surfaceLevel?: SurfaceLevelInput;
  text?: string;
  /** Auto-close after this many ms. Pass `0` to disable auto-close. Default `5000`. */
  timeout?: number;
  title?: string;
  /** Surface variant. Default `'gradient'`. */
  variant?: SurfaceVariant;
}

export type ToastDefaultProps = Partial<Omit<ToastProps, "icon" | "iconProps" | "text" | "title">>;
