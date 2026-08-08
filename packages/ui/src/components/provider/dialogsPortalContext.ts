import { inject, provide, shallowRef, type InjectionKey, type ShallowRef } from "vue";

import type { UiAccent } from "../../foundations/contracts.ts";

/**
 * Shape of the currently open dialog in the imperative dialog portal. The portal renders at most
 * one dialog at a time; opening a new one replaces the previous via the context setter.
 */
export interface DialogsPortalData {
  /** Label for the cancel button. When omitted, the cancel button is not rendered. */
  cancelButtonColor?: UiAccent;
  cancelButtonText?: string;
  /** Color for the confirm button. Default: theme accent color. */
  confirmButtonColor?: UiAccent;
  /** Label for the confirm button. When omitted, the confirm button is not rendered. */
  confirmButtonText?: string;
  /** Defer rendering until first opened, and unmount after close. */
  lazy?: boolean;
  /** Fires when the cancel button is pressed. Always called with `false`. */
  onCancel?: (cancelled: boolean) => void;
  /** Fires after the close transition completes — use for unmount cleanup. */
  onClosed?: (closed: boolean) => void;
  /** Fires when the confirm button is pressed and the guard passes. Always called with `true`. */
  onConfirm?: (confirmed: boolean) => void;
  /**
   * Type-to-confirm guard. If truthy, the confirm button is disabled until the user types this
   * exact value. Forwarded to `Dialog.requireConfirmText` after `String(...)` coercion.
   */
  requireConfirmText?: boolean | string;
  /** Stop click propagation on backdrop and surface. */
  stopPropagationOnClick?: boolean;
  /** Dialog body text — auto-wired to `aria-describedby`. */
  text: string;
  /** Dialog title — auto-wired to `aria-labelledby`. */
  title: string;
}

export interface DialogsPortalContext {
  data: ShallowRef<DialogsPortalData | null>;
  state: ShallowRef<boolean>;
}

const dialogsPortalContextKey: InjectionKey<DialogsPortalContext> = Symbol("cui-dialogs-portal");

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
