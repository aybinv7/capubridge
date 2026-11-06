import type { CellTone } from "./tone";

/** One line of a `KeyValueList`. */
export interface KeyValueRow {
  key: string;
  value: string;
  tone?: CellTone;
  clamp?: boolean;
  /** Makes the value a link that shows where this fact is told in full. */
  action?: () => void;
}
