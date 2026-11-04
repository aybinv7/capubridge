import type { FieldSize } from './form.contracts.ts';
import type { OTPInputMode } from './otpFieldContext.ts';

export interface OTPFieldProps {
  /** Visually dim the field and disable interaction with all cells. */
  disabled?: boolean;
  /** Forwarded to each underlying `<input>`. Default `'numeric'` (matches the digits-only default pattern). */
  inputMode?: OTPInputMode;
  /**
   * Maximum number of characters / cells. When omitted, inferred from the count of `OTPFieldInput` children.
   */
  maxLength?: number;
  /**
   * Regex source that matches a single allowed character. Default `'[0-9]'`.
   *
   * Applied as a filter for typed and pasted input.
   */
  pattern?: string;
  /** Make every cell non-editable but still focusable. */
  readOnly?: boolean;
  /** Cell size. Default `'lg'`. */
  size?: FieldSize;
  /** Render the invalid focus ring flush against the cells (`inset-0`) instead of offset outside them (`-inset-1.5`). Use when the field sits at the edge of an `overflow` container, where the offset ring would add unwanted scroll overflow. Default `false`. */
  tightFocusRing?: boolean;
  /**
   * Validity state. Default `true`. When `false`, the entire field renders a single red focus ring around all cells.
   */
  valid?: boolean;
}

/** Shape of `OTPField` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type OTPFieldDefaultProps = Partial<OTPFieldProps>;

export interface OTPFieldInputProps {
  /** Extra classes for the underlying `<input>` element. */
  inputClassName?: string;
  /** Input placeholder. */
  placeholder?: string;
}

/** Shape of `OTPFieldInput` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type OTPFieldInputDefaultProps = Partial<OTPFieldInputProps>;

export interface OTPFieldSeparatorProps {
  /** Extra classes applied to the separator. */
  className?: string;
}

/** Shape of `OTPFieldSeparator` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type OTPFieldSeparatorDefaultProps = Partial<OTPFieldSeparatorProps>;
