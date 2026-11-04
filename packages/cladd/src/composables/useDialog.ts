import type { VNodeChild } from 'vue';

import { useDialogsPortalContext } from '../components/dialogsPortalContext.ts';
import { useAccentColor } from '../contexts/uiContext.ts';
import type { Color } from '../types.ts';

export interface UseDialogOptions {
  /** Defer rendering until first opened, and unmount after close. Default `false`. */
  lazy?: boolean;
}

export interface UseDialogConfirmOptions {
  /** Cancel button color. Default `'neutral'`. */
  cancelButtonColor?: Color;
  /** Cancel button label. Default `'Cancel'`. Upstream `ReactNode` → `string | VNodeChild`. */
  cancelButtonText?: string | VNodeChild;
  /** Confirm button color. Default: theme accent color. */
  confirmButtonColor?: Color;
  /** Confirm button label. Default `'Confirm'`. Upstream `ReactNode` → `string | VNodeChild`. */
  confirmButtonText?: string | VNodeChild;
  /** Fires when the cancel button is pressed. Always called with `false`. */
  onCancel?: (cancelled: boolean) => void;
  /** Fires after the close transition completes — use for unmount cleanup. */
  onClosed?: (closed: boolean) => void;
  /** Fires when the confirm button is pressed and the guard passes. Always called with `true`. */
  onConfirm?: (confirmed: boolean) => void;
  /**
   * Type-to-confirm guard. When set, renders an `Input` and disables the confirm button until the
   * user types this exact value verbatim — for irreversible destructive actions.
   */
  requireConfirmText?: string | boolean;
  /** Stop click propagation on backdrop and surface. */
  stopPropagationOnClick?: boolean;
  /** Dialog body text — auto-wired to `aria-describedby`. Upstream `string | ReactNode` → `string | VNodeChild`. */
  text?: string | VNodeChild;
  /** Dialog title — auto-wired to `aria-labelledby`. Upstream `string` + slot → `string | VNodeChild`. */
  title?: string | VNodeChild;
}

export interface UseDialogAlertOptions {
  /** Confirm button label. Default `'Ok'`. Upstream `ReactNode` → `string | VNodeChild`. */
  confirmButtonText?: string | VNodeChild;
  /** Fires when the confirm button is pressed. Always called with `true`. */
  onConfirm?: (confirmed: boolean) => void;
  /** Fires after the close transition completes — use for unmount cleanup. */
  onClosed?: (closed: boolean) => void;
  /** Stop click propagation on backdrop and surface. */
  stopPropagationOnClick?: boolean;
  text?: string | VNodeChild;
  title?: string | VNodeChild;
}

export interface DialogApi {
  alert: (options: UseDialogAlertOptions) => void;
  confirm: (options: UseDialogConfirmOptions) => void;
}

/** Imperative handle onto the `DialogsPortal` that `CladdProvider` renders. */
export function useDialog({ lazy }: UseDialogOptions = {}): DialogApi {
  const { data, state } = useDialogsPortalContext();
  const accentColor = useAccentColor();

  return {
    alert({
      confirmButtonText = 'Ok',
      onClosed = () => {},
      onConfirm = () => {},
      stopPropagationOnClick = false,
      text,
      title,
    }: UseDialogAlertOptions) {
      data.value = {
        confirmButtonText,
        lazy,
        onClosed,
        onConfirm,
        stopPropagationOnClick,
        text,
        title,
      };
      state.value = true;
    },
    confirm({
      cancelButtonColor = 'neutral',
      cancelButtonText = 'Cancel',
      confirmButtonColor = accentColor.value,
      confirmButtonText = 'Confirm',
      onCancel = () => {},
      onClosed = () => {},
      onConfirm = () => {},
      requireConfirmText = false,
      stopPropagationOnClick = false,
      text,
      title,
    }: UseDialogConfirmOptions) {
      data.value = {
        cancelButtonColor,
        cancelButtonText,
        confirmButtonColor,
        confirmButtonText,
        lazy,
        onCancel,
        onClosed,
        onConfirm,
        requireConfirmText,
        stopPropagationOnClick,
        text,
        title,
      };
      state.value = true;
    },
  };
}
