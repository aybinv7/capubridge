import type { Color } from "@capubridge/cladd";

/** The dot beside a state word: an accent only when the state means something. */
export interface StatusMark {
  color: Color | undefined;
  variant: "solid" | "hollow";
}

/** A short state word and one plain sentence about it. */
export interface StatusCopy {
  label: string;
  detail: string;
}
