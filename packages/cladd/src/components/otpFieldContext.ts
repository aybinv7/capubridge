import { inject, provide, type ComputedRef, type InjectionKey } from 'vue';

import type { FieldSize } from './form.contracts.ts';

export type OTPInputMode =
  | 'decimal'
  | 'email'
  | 'none'
  | 'numeric'
  | 'search'
  | 'tel'
  | 'text'
  | 'url';

/**
 * Internal state shared by the `OTPField` parent with each `OTPFieldInput` cell. Cells
 * don't own their own state - they read their value/handlers from this context.
 */
export interface OTPFieldContextValue {
  /** Claims the next cell index. Called once per cell during setup, replacing upstream's `cloneElement` index injection. */
  claimIndex: () => number;
  /** Disabled state from the parent - dims and disables every cell. */
  disabled: ComputedRef<boolean>;
  /** Returns the current character for the cell at `index`. */
  getCellValue: (index: number) => string;
  /** Native `inputMode` for every cell. Default `'numeric'`. */
  inputMode: ComputedRef<OTPInputMode>;
  /** Fires when a cell's value changes - parent updates the combined OTP value and advances focus. */
  onCellChange: (index: number, value: string) => void;
  /** Selects the cell's content on focus so typing replaces the existing digit. */
  onCellFocus: (index: number, event: FocusEvent) => void;
  /** Handles Backspace/Arrow navigation between cells. */
  onCellKeyDown: (index: number, event: KeyboardEvent) => void;
  /** Distributes a pasted string across the remaining cells, starting at `index`. */
  onCellPaste: (index: number, event: ClipboardEvent) => void;
  /** Per-cell `pattern` regex (single character match). Default `'[0-9]'`. */
  pattern: ComputedRef<string>;
  /** Read-only state from the parent - blocks editing while keeping cells focusable. */
  readOnly: ComputedRef<boolean>;
  /** Each cell calls this on mount/unmount so the parent can build a ref list (for focus navigation, paste, etc.). */
  registerInput: (index: number, el: HTMLInputElement | undefined) => void;
  /** Size token forwarded from the parent `OTPField`. */
  size: ComputedRef<FieldSize>;
  /** Validity state from the parent - drives the cells' red focus ring when `false`. */
  valid: ComputedRef<boolean>;
}

const otpFieldContextKey: InjectionKey<OTPFieldContextValue> =
  Symbol('cladd-otp-field');

export function provideOTPFieldContext(value: OTPFieldContextValue): void {
  provide(otpFieldContextKey, value);
}

export function useOTPFieldContext(): OTPFieldContextValue | undefined {
  return inject(otpFieldContextKey, undefined);
}
