import type { ChoiceSize } from "./form.contracts.ts";

export const sliderRootHeights: Record<ChoiceSize, string> = {
  xs: "h-cui-thumb-xs",
  sm: "h-cui-thumb-sm",
  md: "h-cui-thumb-md",
};

export const sliderThumbSizes: Record<ChoiceSize, string> = {
  xs: "size-cui-thumb-xs",
  sm: "size-cui-thumb-sm",
  md: "size-cui-thumb-md",
};

export const sliderTrackBarClasses: Record<ChoiceSize, string> = {
  xs: "-mt-0.75 h-1.5",
  sm: "-mt-0.75 h-1.5",
  md: "-mt-1 h-2",
};

export const sliderRangeInsets: Record<ChoiceSize, string> = {
  xs: "right-px left-px",
  sm: "right-px left-px",
  md: "right-0.75 left-0.75",
};

export const sliderValueOffsets: Record<ChoiceSize, string> = {
  xs: "left-2",
  sm: "left-2.5",
  md: "left-3",
};

export const sliderThumbSpacingVars: Record<ChoiceSize, string> = {
  xs: "var(--spacing-cui-thumb-xs)",
  sm: "var(--spacing-cui-thumb-sm)",
  md: "var(--spacing-cui-thumb-md)",
};
