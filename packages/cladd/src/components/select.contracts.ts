import type {
  SurfaceLevelInput,
  SurfaceVariant,
  UiSize,
} from '../foundations/contracts.ts';
import type { Color } from '../types.ts';
import type { ButtonSurface } from './button.contracts.ts';
import type { PopoverOffset, PopoverPosition } from './overlay.contracts.ts';

export type SelectValue = string | number | boolean | null;

export interface SelectOption {
  disabled?: boolean;
  info?: string;
  label: string;
  value: SelectValue;
}

export type SelectOptionInput =
  | SelectValue
  | SelectOption
  | Record<string, unknown>;

export interface SelectOptionParams {
  index: number;
  selected: boolean;
  value: SelectOptionInput;
}

export interface SelectProps {
  /**
   * External anchor element. When provided, the trigger button is **not rendered** — the caller
   * owns the trigger and the open state (upstream's `anchorRef`).
   */
  anchorElement?: HTMLElement;
  /** Close the popover after a single-select pick. Default `true`. Has no effect when `multiple`. */
  closeOnSelect?: boolean;
  /** Accent color for the trigger button. Forwarded to `Button.color`. */
  color?: Color;
  /** Extra classes for the trigger button's inner content row. */
  contentClassName?: string;
  /** Visually dim the trigger and prevent the popover from opening. */
  disabled?: boolean;
  /** Show the chevron-down indicator on the right of the trigger. Default `true`. */
  dropdownIcon?: boolean;
  /** Force the focus ring on, regardless of actual keyboard focus. */
  focused?: boolean;
  /**
   * Extracts the comparable key `V` from each option. Default: identity (`V = T`).
   *
   * Required when options are objects and `value` should be a key (e.g. `id`)
   * rather than a full option reference.
   */
  getOptionValue?: (option: SelectOptionInput) => SelectValue;
  /** Forwarded to the underlying surface. Defaults to `true`.  Suppressed automatically when `disabled` or `readOnly`. */
  hoverable?: boolean;
  /** Default color for the per-option indicator (Radio/Checkbox). Overridden per-option by `optionIndicatorColor`. */
  indicatorColor?: Color;
  /** Custom "is this option selected?" predicate - overrides the built-in equality check. */
  isChecked?: (option: SelectOptionInput) => boolean;
  /** Predicate that disables individual options - dims them and prevents selection. */
  isOptionDisabled?: (option: SelectOptionInput) => boolean;
  /** Extra classes for the icon wrapper. */
  iconClassName?: string;
  /**
   * Show numeric quick-pick hints (0–9) next to options, and bind `0`–`9` keys to select them.
   *
   * Default `true`. See `noneOptionValue` for how the digits map to options.
   */
  keyboardHints?: boolean;
  /** Extra classes for the per-option `Shortcut` hint's key element. */
  keyboardHintsClassName?: string;
  /** `outline` forwarded to the per-option `Shortcut` hint. Default `false`. */
  keyboardHintsOutline?: boolean;
  /** `size` forwarded to the per-option `Shortcut` hint. Default `'md'`. */
  keyboardHintsSize?: UiSize;
  /** `variant` forwarded to the per-option `Shortcut` hint. Default `'transparent'`. */
  keyboardHintsVariant?: SurfaceVariant;
  /** Forwarded to the trigger `Button` - allows wrapping the value across multiple lines. */
  multiline?: boolean;
  /** Allow more than one item open at once. Selection becomes an array. Default `false`. */
  multiple?: boolean;
  /**
   * Value of the "none/initial" option that should be mapped to the 0 key.
   *
   *  If set, this option gets hint "0" and remaining options get 1-9 in order.
   *
   *  If not set, straight ordering: 1, 2, 3, ..., 9, 0 (for 10th).
   */
  noneOptionValue?: SelectValue;
  /** Per-option indicator color. Return `undefined` to fall back to `indicatorColor`. */
  optionIndicatorColor?: (params: SelectOptionParams) => Color | undefined;
  /** Read an option's secondary line. Declared explicitly where upstream reads it through its option renderer. */
  optionInfo?: (params: SelectOptionParams) => string | undefined;
  /** Read an option's label. Declared explicitly where upstream reads it through its option renderer. */
  optionLabel?: (params: SelectOptionParams) => string;
  /** All available options. Compared against `value` via `getOptionValue` (default: identity). */
  options?: readonly SelectOptionInput[];
  /** Render the trigger button's surface outline ring. Forwarded to `Button.outline`. */
  outline?: boolean;
  /** Placeholder node shown in the trigger when `value` is empty and no `children` are provided. */
  placeholder?: string;
  /** Extra classes applied to the value/placeholder container inside the trigger. */
  placeholderClassName?: string;
  /** Accent color for the popover. Forwarded to `Popover.color`. */
  popoverColor?: Color;
  /** Default `'w-auto min-w-[160px]'`. */
  popoverClassName?: string;
  /** Default `['-50%', 4]` - half-width inward shift on the cross axis, 4px main-axis gap. */
  popoverOffset?: PopoverOffset;
  /** Default `'bottom-end'`. */
  popoverPosition?: PopoverPosition;
  /**
   * Surface level for the popover.
   *
   * Default same as Popover's `surfaceLevel` prop.
   */
  popoverSurfaceLevel?: number | string;
  /** Show the trigger with the current value but block opening the popover. */
  readOnly?: boolean;
  /** Force the pressed visual state, regardless of pointer activity. */
  pressed?: boolean;
  /** Reverse the visual order of `icon` ↔ value inside the trigger button. */
  reverse?: boolean;
  /** Pill-style trigger button. Forwarded to `Button.rounded`. */
  rounded?: boolean;
  /** Scroll the popover so the currently selected option is centered when it opens. */
  scrollToSelected?: boolean;
  /** Render a search bar at the top of the popover. Pair with `onSearch` to filter options. */
  search?: boolean;
  /**
   * Filter callback invoked with the current query — returns the filtered list of options.
   * Upstream's `onSearch`; a returning callback can't be a Vue emit, hence the prop name.
   *
   * The Select keeps no internal filter state; callers control matching.
   */
  searchFilter?: (query: string) => readonly SelectOptionInput[];
  /** Auto-focus the search input when the popover opens (skipped on iOS/Android to avoid keyboard popup). */
  searchFocus?: boolean;
  /** Empty-state text. Default `'Nothing found'`. */
  searchNotFound?: string;
  /** Default `'Search'`. */
  searchPlaceholder?: string;
  /** Trigger button size. Forwarded to `Button.size`. */
  size?: UiSize;
  /**
   * Trigger button surface type, forwarded to the underlying `Button.surface`: `'surface'` (default) for a regular button, `'cut'` for an inset/recessed look.
   */
  surface?: ButtonSurface;
  /** Render the focus ring flush against the element (`inset-0`) instead of offset outside it (`-inset-1.5`). Use when the button sits at the edge of an `overflow` container, where the offset ring would add unwanted scroll overflow. Default `false`. */
  tightFocusRing?: boolean;
  /** Title shown at the top of the popover (above the search bar, if any). */
  title?: string;
  /** Extra classes for the value display inside the trigger button. */
  valueClassName?: string;
  /** Underlying `Surface` variant - see `SurfaceVariant`. Defaults to `'gradient'`. */
  variant?: SurfaceVariant;
  /** Inherited from `ButtonProps` via `SelectProps & Omit<ButtonProps, ...>` — polymorphic root element for the trigger. */
  as?: string;
  /** Inherited from `ButtonProps` — enables active/pressed visual states. Default `true`. */
  clickable?: boolean;
  /** Inherited from `ButtonProps` — whether the trigger can receive focus. Default `true`. */
  focusable?: boolean;
  /** Inherited from `ButtonProps` — show a centered `Spinner` overlay and fade content. */
  loading?: boolean;
  /** Inherited from `ButtonProps` — render as an icon-only square button. */
  square?: boolean;
  /** Inherited from `ButtonProps` — forwarded to the trigger `Surface` as `level`. */
  surfaceLevel?: SurfaceLevelInput;
}

export type SelectDefaultProps = Partial<
  Omit<
    SelectProps,
    | 'anchorElement'
    | 'getOptionValue'
    | 'isChecked'
    | 'isOptionDisabled'
    | 'noneOptionValue'
    | 'optionIndicatorColor'
    | 'options'
    | 'searchFilter'
  >
>;

export const selectTriggerClasses = 'cladd-select w-full';

export const selectTriggerContentClasses =
  'flex w-full min-w-0 shrink items-center justify-between gap-2';

export const selectTriggerDropdownPaddingClasses = 'pr-1.5';

export const selectTriggerReverseClasses = 'flex-row-reverse';

export const selectIconClasses = 'shrink-0';

export const selectValueClasses = 'w-full min-w-0 shrink';

export const selectPlaceholderClasses = 'text-cladd-fg-softer';

export const selectDropdownIconClasses = 'size-4 shrink-0 text-cladd-fg-softer';

export const selectPopoverClasses = 'w-auto min-w-[160px] overflow-hidden';

export const selectTitleClasses = 'px-4 pt-4';

export const selectSearchInsetWrapperClasses = 'contents';

export const selectSearchStickyWrapperClasses =
  'sticky top-0 z-20 rounded-t-cladd-popover border-b border-cladd-outline';

export const selectSearchStickyContentClasses = 'p-2';

export const selectSearchFieldClasses = 'sticky z-20';

export const selectSearchFieldInsetClasses = 'top-2 mx-2 mt-2 w-auto';

export const selectEmptyClasses =
  'mb-2 flex h-8 w-full items-center pr-4 pl-4 text-cladd-xs font-medium text-cladd-fg-softer';

export const selectOptionContentClasses = 'pl-1';

export const selectOptionRowClasses = 'flex w-full items-center gap-3';

export const selectOptionIndicatorClasses = 'shrink-0';

export const selectOptionCopyClasses = 'w-full min-w-0 shrink';

export const selectOptionInfoClasses =
  'text-cladd-xs font-normal text-cladd-fg-soft';

export const selectHintClasses = 'ml-auto shrink-0 tabular-nums';

export const selectHintKeyClasses = 'font-normal text-cladd-fg-soft';

/** Default popover offset: half-width inward shift on the cross axis, 4px main-axis gap. */
export const selectPopoverOffset: PopoverOffset = ['-50%', 4];

function getTextValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return undefined;
}

export function getDefaultOptionValue(option: SelectOptionInput): SelectValue {
  if (typeof option !== 'object' || option === null) return option;
  if ('value' in option) {
    const value = option.value;
    if (
      value === null ||
      ['string', 'number', 'boolean'].includes(typeof value)
    ) {
      return value as SelectValue;
    }
  }
  return null;
}

export function getDefaultOptionLabel(option: SelectOptionInput): string {
  if (typeof option === 'object' && option !== null && 'label' in option) {
    return getTextValue(option.label) ?? '';
  }
  return getTextValue(option) ?? '';
}

export function getDefaultOptionInfo(
  option: SelectOptionInput,
): string | undefined {
  if (typeof option === 'object' && option !== null && 'info' in option) {
    return getTextValue(option.info);
  }
  return undefined;
}
