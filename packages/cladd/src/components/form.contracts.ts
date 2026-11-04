import type { UiSize } from '../foundations/contracts.ts';

export const fieldSizes = [
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
] as const satisfies readonly UiSize[];
export type FieldSize = (typeof fieldSizes)[number];

export const choiceSizes = [
  'xs',
  'sm',
  'md',
] as const satisfies readonly UiSize[];
export type ChoiceSize = (typeof choiceSizes)[number];

export const switchSizes = ['sm', 'md'] as const satisfies readonly UiSize[];

export const sliderVariants = ['thumb', 'track'] as const;
export type SliderVariant = (typeof sliderVariants)[number];

export type SliderScale =
  | 'linear'
  | 'log'
  | {
      fromSlider: (position: number) => number;
      toSlider: (value: number) => number;
    };
