import type { UiAccent, SurfaceVariant } from "../../foundations/contracts.ts";
import type { SegmentedProps } from "./segmented.contracts.ts";

export interface ToggleGroupOwnProps {
  /** Initial selection (uncontrolled). Ignored when `value` is provided. */
  defaultValue?: string | string[];
  /** Allow more than one selected value. Selection becomes an array. Default `false`. */
  multiple?: boolean;
  /** Controlled selection. A single value in single-select mode, an array when `multiple`. */
  value?: string | string[];
}

// `ToggleGroupOwnProps` and `SegmentedProps` share no keys, so this is a plain intersection —
// written without `Omit<SegmentedProps, keyof ToggleGroupOwnProps>` because the SFC compiler's
// type-only `defineProps` macro cannot resolve that shape into a finite prop list.
export type ToggleGroupProps = ToggleGroupOwnProps & SegmentedProps;

export type ToggleGroupDefaultProps = Partial<
  Omit<ToggleGroupProps, "as" | "defaultValue" | "value">
>;

export interface ToggleButtonOwnProps {
  /** Accent color applied while pressed. Default: theme accent (or the group's `activeColor`). */
  activeColor?: UiAccent;
  /** Outline ring while pressed. Default `true`. */
  activeOutline?: boolean;
  /** Surface variant applied while pressed. Default `'gradient'`. */
  activeVariant?: SurfaceVariant;
  /** Initial pressed state for standalone use (uncontrolled). Ignored inside a `ToggleGroup`. */
  defaultSelected?: boolean;
  /** Controlled pressed state for standalone use. Ignored inside a `ToggleGroup`. */
  selected?: boolean;
  /** Identifies this button inside a `ToggleGroup`. Omit when used standalone. */
  value?: string;
}

export type ToggleButtonDefaultProps = Partial<
  Omit<ToggleButtonOwnProps, "defaultSelected" | "selected" | "value">
>;
