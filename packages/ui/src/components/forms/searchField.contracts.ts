import type { UiAccent } from "../../foundations/contracts.ts";
import type { FieldSize } from "./form.contracts.ts";

export const searchFieldClasses = "cui-search-field w-full";

export const searchFieldIconClasses = "text-cui-fg-softer";

export interface SearchFieldProps {
  accent?: UiAccent;
  /** Default `true`. */
  clearButton?: boolean;
  color?: UiAccent;
  /** Default `'Search'`. */
  placeholder?: string;
  /** Default `true`. */
  rounded?: boolean;
  /** Default `'lg'`. */
  size?: FieldSize;
}

export type SearchFieldDefaultProps = Partial<SearchFieldProps>;
