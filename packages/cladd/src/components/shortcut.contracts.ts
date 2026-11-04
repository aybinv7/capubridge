import type { UiSize } from '../foundations/contracts.ts';

export const shortcutIconSizes: Record<UiSize, string> = {
  '2xs': 'size-1.5',
  xs: 'size-2.5',
  sm: 'size-3',
  md: 'size-3.5',
  lg: 'size-4',
  xl: 'size-5',
  '2xl': 'size-6',
};

export const shortcutRoundedClasses: Record<UiSize, string> = {
  '2xs': 'rounded-cladd-3xs',
  xs: 'rounded-cladd-2xs',
  sm: 'rounded-cladd-xs',
  md: 'rounded-cladd-sm',
  lg: 'rounded-cladd-md',
  xl: 'rounded-cladd-lg',
  '2xl': 'rounded-cladd-xl',
};

export const shortcutFontSizes: Record<UiSize, string> = {
  '2xs': 'text-cladd-4xs',
  xs: 'text-cladd-3xs',
  sm: 'text-cladd-2xs',
  md: 'text-cladd-xs',
  lg: 'text-cladd-xs',
  xl: 'text-cladd-sm',
  '2xl': 'text-cladd-md',
};
