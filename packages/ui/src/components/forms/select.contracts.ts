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
  /**
   * External anchor element. When provided, the trigger button is **not rendered** — the caller
   * owns the trigger and the open state (upstream's `anchorRef`).
   */
  anchorElement?: HTMLElement;
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
  iconClassName?: string;
  keyboardHints?: boolean;
  keyboardHintsClassName?: string;
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
  placeholderClassName?: string;
  popoverAccent?: UiAccent;
  popoverClassName?: string;
  popoverOffset?: PopoverOffset;
  popoverPosition?: PopoverPosition;
  popoverSurfaceLevel?: number | string;
  readOnly?: boolean;
  pressed?: boolean;
  reverse?: boolean;
  rounded?: boolean;
  scrollToSelected?: boolean;
  search?: boolean;
  /**
   * Filter callback invoked with the current query — returns the filtered list of options.
   * Upstream's `onSearch`; a returning callback can't be a Vue emit, hence the prop name.
   *
   * The Select keeps no internal filter state; callers control matching.
   */
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

export type SelectDefaultProps = Partial<
  Omit<
    SelectProps,
    | "anchorElement"
    | "getOptionValue"
    | "isChecked"
    | "isOptionDisabled"
    | "noneOptionValue"
    | "optionIndicatorColor"
    | "options"
    | "searchFilter"
  >
>;

export const selectTriggerClasses = "cui-select w-full";

export const selectTriggerContentClasses =
  "flex w-full min-w-0 shrink items-center justify-between gap-2";

export const selectTriggerDropdownPaddingClasses = "pr-1.5";

export const selectTriggerReverseClasses = "flex-row-reverse";

export const selectIconClasses = "shrink-0";

export const selectValueClasses = "w-full min-w-0 shrink";

export const selectPlaceholderClasses = "text-cui-fg-softer";

export const selectDropdownIconClasses = "size-4 shrink-0 text-cui-fg-softer";

export const selectPopoverClasses = "w-auto min-w-[160px] overflow-hidden";

export const selectTitleClasses = "px-4 pt-4";

export const selectSearchInsetWrapperClasses = "contents";

export const selectSearchStickyWrapperClasses =
  "sticky top-0 z-20 rounded-t-cui-popover border-b border-cui-outline";

export const selectSearchStickyContentClasses = "p-2";

export const selectSearchFieldClasses = "sticky z-20";

export const selectSearchFieldInsetClasses = "top-2 mx-2 mt-2 w-auto";

export const selectEmptyClasses =
  "mb-2 flex h-8 w-full items-center pr-4 pl-4 text-cui-xs font-medium text-cui-fg-softer";

export const selectOptionContentClasses = "pl-1";

export const selectOptionRowClasses = "flex w-full items-center gap-3";

export const selectOptionIndicatorClasses = "shrink-0";

export const selectOptionCopyClasses = "w-full min-w-0 shrink";

export const selectOptionInfoClasses = "text-cui-xs font-normal text-cui-fg-soft";

export const selectHintClasses = "ml-auto shrink-0 tabular-nums";

export const selectHintKeyClasses = "font-normal text-cui-fg-soft";

/** Default popover offset: half-width inward shift on the cross axis, 4px main-axis gap. */
export const selectPopoverOffset: PopoverOffset = ["-50%", 4];

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
