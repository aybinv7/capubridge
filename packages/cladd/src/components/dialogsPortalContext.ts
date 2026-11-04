import {
  inject,
  provide,
  shallowRef,
  type InjectionKey,
  type ShallowRef,
  type VNodeChild,
} from 'vue';

import type { Color } from '../types.ts';

/**
 * Shape of the currently open dialog in the imperative dialog portal. The portal renders at most
 * one dialog at a time; opening a new one replaces the previous via the context setter.
 */
export interface DialogsPortalData {
  /** Label for the cancel button. When omitted, the cancel button is not rendered. Upstream `ReactNode` → `string | VNodeChild`. */
  cancelButtonColor?: Color;
  cancelButtonText?: string | VNodeChild;
  /** Color for the confirm button. Default: theme accent color. */
  confirmButtonColor?: Color;
  /** Label for the confirm button. When omitted, the confirm button is not rendered. Upstream `ReactNode` → `string | VNodeChild`. */
  confirmButtonText?: string | VNodeChild;
  /** Defer rendering until first opened, and unmount after close. */
  lazy?: boolean;
  /** Fires when the cancel button is pressed. Always called with `false`. */
  onCancel?: (cancelled: boolean) => void;
  /** Fires after the close transition completes — use for unmount cleanup. */
  onClosed?: (closed: boolean) => void;
  /** Fires when the confirm button is pressed and the guard passes. Always called with `true`. */
  onConfirm?: (confirmed: boolean) => void;
  requireConfirmText?: boolean | string;
  /** Stop click propagation on backdrop and surface. */
  stopPropagationOnClick?: boolean;
  /** Dialog body text — auto-wired to `aria-describedby`. Upstream `string | ReactNode` → `string | VNodeChild`. */
  text?: string | VNodeChild;
  /** Dialog title — auto-wired to `aria-labelledby`. */
  title?: string | VNodeChild;
}

export interface DialogsPortalContext {
  data: ShallowRef<DialogsPortalData | null>;
  state: ShallowRef<boolean>;
}

const dialogsPortalContextKey: InjectionKey<DialogsPortalContext> = Symbol(
  'cladd-dialogs-portal',
);

const fallback: DialogsPortalContext = {
  data: shallowRef<DialogsPortalData | null>(null),
  state: shallowRef(false),
};

export function provideDialogsPortalContext(): DialogsPortalContext {
  const context: DialogsPortalContext = {
    data: shallowRef<DialogsPortalData | null>(null),
    state: shallowRef(false),
  };
  provide(dialogsPortalContextKey, context);
  return context;
}

export function useDialogsPortalContext(): DialogsPortalContext {
  return inject(dialogsPortalContextKey, fallback);
}
