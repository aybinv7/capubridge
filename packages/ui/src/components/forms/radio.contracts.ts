import type { ChoiceSize } from "./form.contracts.ts";

export const radioRootSizes: Record<ChoiceSize, string> = {
  xs: "size-cui-thumb-xs p-0",
  sm: "size-cui-thumb-sm p-1",
  md: "size-cui-thumb-md p-1",
};

export const radioIndicatorSizes: Record<ChoiceSize, string> = {
  xs: "size-1.5",
  sm: "size-2",
  md: "size-2",
};
