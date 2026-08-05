import type { SwitchSize } from "./form.contracts.ts";

export const switchRootSizes: Record<SwitchSize, string> = {
  sm: "w-10 p-1",
  md: "w-12 p-1",
};

export const switchThumbSizes: Record<SwitchSize, string> = {
  sm: "size-cui-thumb-xs",
  md: "size-cui-thumb-sm",
};

export const switchThumbOffsets: Record<SwitchSize, string> = {
  sm: "translate-x-cui-thumb-xs",
  md: "translate-x-cui-thumb-sm",
};
