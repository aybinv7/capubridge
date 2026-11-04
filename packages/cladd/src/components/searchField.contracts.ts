import type { InputProps } from './input.contracts.ts';

export const searchFieldClasses = 'cladd-search-field w-full';

export const searchFieldIconClasses = 'text-cladd-fg-softer';

export interface SearchFieldProps extends InputProps {}

export type SearchFieldDefaultProps = Partial<
  Omit<SearchFieldProps, 'as' | 'inputComponent' | 'inputProps'>
>;
