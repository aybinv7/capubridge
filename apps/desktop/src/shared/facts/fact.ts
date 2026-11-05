/** One line of a facts list. `copy` is what the copy button puts on the clipboard. */
export interface Fact {
  key: string;
  label: string;
  value: string;
  detail?: string;
  mono?: boolean;
  quiet?: boolean;
  copy?: string;
  /** Full text shown on hover when the value is shortened. */
  hint?: string;
  /** 0–100 fill of a meter drawn under the value. */
  meter?: number;
  /** Names listed under the value on request, as quiet chips (a bridge's plugins). */
  chips?: readonly string[];
}
