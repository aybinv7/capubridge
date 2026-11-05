export type DetailTab = "headers" | "payload" | "response" | "timing" | "cookies";

export const DETAIL_TABS: ReadonlyArray<{ value: DetailTab; label: string }> = [
  { value: "headers", label: "Headers" },
  { value: "payload", label: "Payload" },
  { value: "response", label: "Response" },
  { value: "timing", label: "Timing" },
  { value: "cookies", label: "Cookies" },
];

/** The tab `step` places away, wrapping at both ends. */
export function cycleTab(current: DetailTab, step: number): DetailTab {
  const index = DETAIL_TABS.findIndex((tab) => tab.value === current);
  const next = (index + step + DETAIL_TABS.length) % DETAIL_TABS.length;
  return DETAIL_TABS[next]?.value ?? current;
}

/** Narrows a stored value to a tab, falling back to Headers. */
export function asDetailTab(value: unknown): DetailTab {
  return DETAIL_TABS.some((tab) => tab.value === value) ? (value as DetailTab) : "headers";
}
