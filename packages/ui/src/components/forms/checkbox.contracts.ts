import type { ChoiceSize } from "./form.contracts.ts";

export const checkboxRootSizes: Record<ChoiceSize, string> = {
  xs: "size-cui-thumb-xs p-0",
  sm: "size-cui-thumb-sm p-1",
  md: "size-cui-thumb-md p-1",
};

export const checkboxIndicatorSizes: Record<ChoiceSize, string> = {
  xs: "size-2.5",
  sm: "size-3",
  md: "size-4",
};
