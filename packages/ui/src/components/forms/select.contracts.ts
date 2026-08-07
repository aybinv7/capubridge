import type { SurfaceVariant, UiAccent, UiSize } from "../../foundations/contracts.ts";
import type { ButtonSurface } from "../actions/button.contracts.ts";
import type { PopoverOffset, PopoverPosition } from "../overlays/overlay.contracts.ts";

export type SelectValue = string | number | boolean | null;

export interface SelectOption {
  disabled?: boolean;
  info?: string;
  label: string;
  value: SelectValue;
}

export type SelectOptionInput = SelectValue | SelectOption | Record<string, unknown>;

export interface SelectOptionParams {
  index: number;
  selected: boolean;
  value: SelectOptionInput;
}

export interface SelectProps {
  accent?: UiAccent;
  closeOnSelect?: boolean;
  color?: UiAccent;
  contentClassName?: string;
  disabled?: boolean;
  dropdownIcon?: boolean;
  focused?: boolean;
  getOptionValue?: (option: SelectOptionInput) => SelectValue;
  hoverable?: boolean;
  indicatorColor?: UiAccent;
  isChecked?: (option: SelectOptionInput) => boolean;
  isOptionDisabled?: (option: SelectOptionInput) => boolean;
  keyboardHints?: boolean;
  keyboardHintsOutline?: boolean;
  keyboardHintsSize?: UiSize;
  keyboardHintsVariant?: SurfaceVariant;
  multiline?: boolean;
  multiple?: boolean;
  noneOptionValue?: SelectValue;
  optionIndicatorColor?: (params: SelectOptionParams) => UiAccent | undefined;
  optionInfo?: (params: SelectOptionParams) => string | undefined;
  optionLabel?: (params: SelectOptionParams) => string;
  options?: readonly SelectOptionInput[];
  outline?: boolean;
  placeholder?: string;
  popoverAccent?: UiAccent;
  popoverOffset?: PopoverOffset;
  popoverPosition?: PopoverPosition;
  popoverSurfaceLevel?: number | string;
  readOnly?: boolean;
  pressed?: boolean;
  reverse?: boolean;
  rounded?: boolean;
  scrollToSelected?: boolean;
  search?: boolean;
  searchFilter?: (query: string) => readonly SelectOptionInput[];
  searchFocus?: boolean;
  searchNotFound?: string;
  searchPlaceholder?: string;
  size?: UiSize;
  surface?: ButtonSurface;
  tightFocusRing?: boolean;
  title?: string;
  valueClassName?: string;
  variant?: SurfaceVariant;
}

function getTextValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export function getDefaultOptionValue(option: SelectOptionInput): SelectValue {
  if (typeof option !== "object" || option === null) return option;
  if ("value" in option) {
    const value = option.value;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      return value as SelectValue;
    }
  }
  return null;
}

export function getDefaultOptionLabel(option: SelectOptionInput): string {
  if (typeof option === "object" && option !== null && "label" in option) {
    return getTextValue(option.label) ?? "";
  }
  return getTextValue(option) ?? "";
}

export function getDefaultOptionInfo(option: SelectOptionInput): string | undefined {
  if (typeof option === "object" && option !== null && "info" in option) {
    return getTextValue(option.info);
  }
  return undefined;
}
