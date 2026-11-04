# Third-party notices

## Cladd

- Project: Cladd
- Source: https://github.com/cladd-ui/cladd
- Audited baseline: `1aaad0ac5b13541823ed876a227949fcc806ca5e`
- Package baseline observed during foundation work: `@cladd-ui/react` 0.19.0
- License: MIT
- Copyright: Copyright (c) 2026 cladd-ui

Cladd is the reference for surface depth, sizing relationships, accent scoping, DOM structure, motion, and interaction behavior. `cladd-vue` is an independent Vue implementation and is not an official Cladd package.

The first Vue surface slice substantially adapts behavior and visual rules from:

- `src/components/Surface.tsx`
- `src/components/SurfaceContext.tsx`
- `src/components/SurfaceCut.tsx`
- `src/components/Button.tsx`
- `src/components/Chip.tsx`
- `src/components/FocusRing.tsx`
- `src/components/Input.tsx`
- `src/components/Textarea.tsx`
- `src/components/Checkbox.tsx`
- `src/components/Radio.tsx`
- `src/components/Switch.tsx`
- `src/components/Slider.tsx`
- `src/components/Dialog.tsx`
- `src/components/Popover.tsx`
- `src/components/Tooltip.tsx`
- `src/components/TooltipPrimitive.tsx`
- `src/components/Backdrop.tsx`
- `src/components/Shortcut.tsx`
- `src/components/Spinner.tsx`
- `src/components/icons/Keyboard*Icon.tsx`
- `src/styles/colors.css`
- `src/styles/font-size.css`
- `src/styles/radius.css`
- `src/styles/spacing.css`
- `src/styles/spinner.css`
- `src/calendar/Calendar.tsx`
- `src/calendar/DatePicker.tsx`
- `src/calendar/CalendarIcon.tsx`

When Cladd source is copied or substantially adapted, retain its MIT notice in this file and record the upstream source path and commit in the implementing change.

## Calendar adapter boundary

`src/calendar/Calendar.tsx` and `src/calendar/DatePicker.tsx` adapt `react-day-picker` (`^10.0.1`, MIT) behind Cladd's `Calendar`/`DatePicker` props. `cladd-vue` does **not** port `react-day-picker` directly — `src/calendar/Calendar.vue` and `src/calendar/DatePicker.vue` are a `@vuepic/vue-datepicker` adapter. The compatibility boundary (prop mapping, copied `SIZES`/`calendarSizes`, and deviations for `disabled`, `locale`, `format`, and `calendarProps`) is documented in `packages/ui/docs/port/Calendar.md`.

## Dependencies

- `@vuepic/vue-datepicker` `^14.0.0` — MIT — https://github.com/Vuepic/vue-datepicker — used as the calendar grid implementation for `Calendar`/`DatePicker`.
- `react-day-picker` `^10.0.1` — MIT — https://github.com/gpbl/react-day-picker — upstream calendar dependency that the Vue adapter replaces (see `Calendar.md`).
