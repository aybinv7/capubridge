import type { UiSize } from '../foundations/contracts.ts';

export const chipPaddings: Record<UiSize, string> = {
  '2xs': 'px-1 [&:has(>svg:first-child)]:pl-1 [&:has(>svg:last-child)]:pr-1',
  xs: 'px-1 [&:has(>svg:first-child)]:pl-1 [&:has(>svg:last-child)]:pr-1',
  sm: 'px-2 [&:has(>svg:first-child)]:pl-1.5 [&:has(>svg:last-child)]:pr-1.5',
  md: 'px-2 [&:has(>svg:first-child)]:pl-1.5 [&:has(>svg:last-child)]:pr-1.5',
  lg: 'px-2.5 [&:has(>svg:first-child)]:pl-2 [&:has(>svg:last-child)]:pr-2',
  xl: 'px-2.5 [&:has(>svg:first-child)]:pl-2 [&:has(>svg:last-child)]:pr-2',
  '2xl': 'px-2.5',
};

export const chipFontSizes: Record<UiSize, string> = {
  '2xs': 'text-cladd-4xs',
  xs: 'text-cladd-3xs',
  sm: 'text-cladd-2xs',
  md: 'text-cladd-2xs',
  lg: 'text-cladd-xs',
  xl: 'text-cladd-xs',
  '2xl': 'text-cladd-xs',
};

export const chipIconSizes: Record<UiSize, string> = {
  '2xs': '[&>svg]:size-1.5',
  xs: '[&>svg]:size-2.5',
  sm: '[&>svg]:size-3',
  md: '[&>svg]:size-3.5',
  lg: '[&>svg]:size-4',
  xl: '[&>svg]:size-4',
  '2xl': '[&>svg]:size-4',
};

export const chipRoundedClasses: Record<UiSize, string> = {
  '2xs': 'rounded-cladd-3xs',
  xs: 'rounded-cladd-3xs',
  sm: 'rounded-cladd-xs',
  md: 'rounded-cladd-sm',
  lg: 'rounded-cladd-md',
  xl: 'rounded-cladd-lg',
  '2xl': 'rounded-cladd-xl',
};
