import type { Locale } from 'date-fns';

import type { ButtonSize } from '../components/button.contracts.ts';
import type {
  PopoverOffset,
  PopoverPosition,
} from '../components/overlay.contracts.ts';
import type { SurfaceLevelInput } from '../foundations/contracts.ts';
import type { Color } from '../types.ts';

/** Sizing token for the calendar grid. */
export type CalendarSize = '2xl' | 'lg' | 'md' | 'sm' | 'xl';

export type DatePickerSize = ButtonSize;

/**
 * A start/end pair, matching the shape upstream re-exports from its calendar
 * dependency. The Vue picker models a range as a two-element array; `Calendar`
 * converts between the two so the public contract stays upstream's.
 */
export interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

export type CalendarMode = 'multiple' | 'range' | 'single';

export type CalendarValue = Date | Date[] | DateRange | undefined;

export interface CalendarSizeTokens {
  box: string;
  captionText: string;
  col: string;
  dayText: string;
  weekdayText: string;
}

/** Copied from upstream `Calendar.tsx:41-77`. */
export const calendarSizes: Record<CalendarSize, CalendarSizeTokens> = {
  sm: {
    box: 'size-cladd-sm',
    col: 'w-cladd-sm',
    dayText: 'text-cladd-2xs',
    weekdayText: 'text-cladd-2xs',
    captionText: 'text-cladd-xs',
  },
  md: {
    box: 'size-cladd-md',
    col: 'w-cladd-md',
    dayText: 'text-cladd-xs',
    weekdayText: 'text-cladd-2xs',
    captionText: 'text-cladd-xs',
  },
  lg: {
    box: 'size-cladd-lg',
    col: 'w-cladd-lg',
    dayText: 'text-cladd-xs',
    weekdayText: 'text-cladd-xs',
    captionText: 'text-cladd-xs',
  },
  xl: {
    box: 'size-cladd-xl',
    col: 'w-cladd-xl',
    dayText: 'text-cladd-sm',
    weekdayText: 'text-cladd-xs',
    captionText: 'text-cladd-sm',
  },
  '2xl': {
    box: 'size-cladd-2xl',
    col: 'w-cladd-2xl',
    dayText: 'text-cladd-sm',
    weekdayText: 'text-cladd-xs',
    captionText: 'text-cladd-sm',
  },
};

export interface CalendarProps {
  /** Accent color token. Sets the `cladd-color-{name}` class - drives selected fill, today, and focus ring. Default: theme accent. */
  color?: Color;
  /** Size of the nav buttons and caption dropdowns. Default `'sm'`. */
  controlSize?: ButtonSize;
  /** Dim the calendar and block interaction, or a matcher function. Accepts a boolean or `(date: Date) => boolean`. Upstream uses a `Matcher` (`disabled`) per `DayPickerProps`. */
  disabled?: boolean | ((date: Date) => boolean);
  /** Extra classes for the `footer` element. */
  footerClassName?: string;
  /** Extra classes for the `header` wrapper. */
  headerClassName?: string;
  /** Hide the previous/next month buttons. Default `false`. */
  hideNavigation?: boolean;
  /** date-fns locale for month names and weekday headers (e.g. `fr`, `de`). */
  locale?: Locale;
  /** Latest selectable date. */
  maxDate?: Date;
  /** Earliest selectable date. */
  minDate?: Date;
  /** Selection mode. Default `'single'`. */
  mode?: CalendarMode;
  /** Number of month grids shown side by side. Upstream forwards this to `react-day-picker` via `calendarProps.numberOfMonths` (`DatePicker.tsx:41`); range pickers typically pass `2`. Default `1`. */
  numberOfMonths?: number;
  /** Block selection while keeping the grid visible. */
  readOnly?: boolean;
  /** Mark today's date with an accent ring and label. Default `true`. */
  showToday?: boolean;
  /** Show days outside the current month. Default `true` (matches upstream `showOutsideDays: true`). */
  showOutsideDays?: boolean;
  /** Sizing token. Drives day-cell size and font sizes. Default `'md'`. */
  size?: CalendarSize;
  /** First day of the week, `0` for Sunday. Default `0`. */
  weekStart?: number;
}

/** Shape of `Calendar` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type CalendarDefaultProps = Partial<CalendarProps>;

export interface DatePickerProps {
  /** Calendar size inside the popover. Default `'lg'`. */
  calendarSize?: CalendarSize;
  /** Extra props forwarded to the underlying `Calendar` (e.g. `disabled` matcher, `locale`, `showOutsideDays`). Upstream `DatePicker.tsx:41-42` forwards `calendarProps` into `Calendar` via spread. */
  calendarProps?: Partial<CalendarProps>;
  /** Close the popover after a pick. Default `true`. Single mode only. */
  closeOnSelect?: boolean;
  /** Extra classes for the trigger's inner content row. */
  contentClassName?: string;
  /** Accent color token. Drives the trigger and the calendar. Default: theme accent. */
  color?: Color;
  /** Dim the trigger and block opening. */
  disabled?: boolean;
  /** Show the chevron indicator on the right of the trigger. Default `true`. */
  dropdownIcon?: boolean;
  /** Format the selected value into the trigger label. When set, overrides `toLocaleDateString`. Mirrors upstream `format?: (value: Date) => ReactNode` per mode. */
  format?: (value: Date | Date[] | DateRange) => string;
  /** Extra classes for the icon wrapper. */
  iconClassName?: string;
  /** Latest selectable date. */
  maxDate?: Date;
  /** Earliest selectable date. */
  minDate?: Date;
  /** Selection mode. Default `'single'`. */
  mode?: CalendarMode;
  /** Number of month grids shown side by side in the popover calendar. Forwarded to `Calendar.numberOfMonths`. Default `1`. */
  numberOfMonths?: number;
  /** Trigger surface outline ring. Forwarded to `Button.outline`. */
  outline?: boolean;
  /** Shown in the trigger when nothing is selected. Default `'Select date'`. */
  placeholder?: string;
  /** Extra classes for the popover surface. Default `'w-auto'`. */
  popoverClassName?: string;
  /** Accent color for the popover. Defaults to `color`. */
  popoverColor?: Color;
  /** Popover spacing from the trigger. Default `['-50%', 4]`. */
  popoverOffset?: PopoverOffset;
  /** Popover anchor side + alignment. Default `'bottom-end'`. */
  popoverPosition?: PopoverPosition;
  /** Surface level for the popover. */
  popoverSurfaceLevel?: SurfaceLevelInput;
  /** Show the value but block opening the popover. */
  readOnly?: boolean;
  /** Pill-style trigger. Forwarded to `Button.rounded`. */
  rounded?: boolean;
  /** Trigger button size. Forwarded to `Button.size`. Default `'md'`. */
  size?: DatePickerSize;
}

/** Shape of `DatePicker` defaults that can be supplied via `CladdProvider`'s `defaults` prop. */
export type DatePickerDefaultProps = Partial<DatePickerProps>;

/**
 * Upstream closes the popover after a pick only in single mode, and only when
 * the caller hasn't opted out (`DatePicker.tsx:206-209`,
 * `if (closeOnSelect !== false) setOpen(false)`). Multiple and range stay open
 * so the user can keep picking. Pulled out as a pure function so the decision
 * is testable without a real pointer click on the dependency's grid, which
 * does not render under happy-dom.
 */
export function shouldCloseAfterSelect(
  mode: CalendarMode,
  closeOnSelect: boolean,
): boolean {
  return mode === 'single' && closeOnSelect;
}
